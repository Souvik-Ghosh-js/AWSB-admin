'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminCard, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton } from '@/components/ui';
import { ApiError, USE_MOCKS, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { formatPaise, rupeesToPaise } from '@/lib/format';
import { mockCategories, mockProducts } from '@/lib/mock-data';
import { SIZES_ML } from '@/lib/shop';
import type {
  AdminProduct,
  Category,
  ProductInput,
  ProductStatus,
  VariantInput,
} from '@/lib/types';

/**
 * Product create / edit, including the per-size price and stock editor.
 *
 * Prices are entered in RUPEES for the admin's sanity and converted to integer
 * paise on save — money crosses the API boundary as paise, never as a float.
 *
 * Stock here is the absolute figure. Adjusting it writes an
 * inventory_movements row server-side, which is why the field explains itself:
 * silently overwriting a stock count is how "where did my stock go?" becomes
 * unanswerable.
 */

interface VariantDraft {
  id?: number;
  sizeMl: number;
  sku: string;
  priceRupees: string;
  compareAtRupees: string;
  stockQty: string;
  lowStockThreshold: string;
  isEnabled: boolean;
  weightGrams: string;
}

function blankVariant(sizeMl: number): VariantDraft {
  return {
    sizeMl,
    sku: '',
    priceRupees: '',
    compareAtRupees: '',
    stockQty: '0',
    lowStockThreshold: '5',
    isEnabled: true,
    weightGrams: '',
  };
}

export default function AdminProductEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const isNew = params.id === 'new';
  const id = Number(params.id);

  const user = getUser();
  const readOnly = !can(user, 'products.edit');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [scentFamily, setScentFamily] = useState('');
  const [status, setStatus] = useState<ProductStatus>('draft');
  const [isFeatured, setIsFeatured] = useState(false);
  const [notesTop, setNotesTop] = useState('');
  const [notesHeart, setNotesHeart] = useState('');
  const [notesBase, setNotesBase] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);

  const [variants, setVariants] = useState<VariantDraft[]>(
    SIZES_ML.map((size) => blankVariant(size))
  );

  /* ------------------------------------------------------------- load */

  useEffect(() => {
    void (async () => {
      const token = getToken();
      if (!token) return;

      // Categories are needed for both create and edit.
      try {
        setCategories(await adminApi.categories(token));
      } catch {
        // The picker is secondary to the product itself, so a failure here
        // falls back to the known seed list rather than blocking the editor.
        setCategories(mockCategories);
      }

      if (isNew) return;

      try {
        const product = await adminApi.product(token, id);
        hydrate(product);
      } catch (err) {
        if (USE_MOCKS || (err instanceof ApiError && err.isNetworkError)) {
          const mock = mockProducts.find((p) => p.id === id);
          if (mock) {
            hydrate({
              id: mock.id,
              slug: mock.slug,
              name: mock.name,
              tagline: mock.tagline,
              description: mock.description,
              scentFamily: mock.scentFamily,
              scentNotes: mock.scentNotes,
              status: 'active',
              isFeatured: mock.isFeatured,
              sortOrder: 0,
              metaTitle: mock.metaTitle,
              metaDescription: mock.metaDescription,
              images: mock.images,
              variants: mock.variants.map((v) => ({
                id: v.id,
                productId: mock.id,
                sizeMl: v.sizeMl,
                sku: v.sku,
                pricePaise: v.pricePaise,
                compareAtPaise: v.compareAtPaise,
                stockQty: v.inStock ? (v.isLowStock ? 3 : 24) : 0,
                lowStockThreshold: 5,
                isEnabled: true,
                weightGrams: null,
              })),
              categories: mock.categories,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          setError(
            err instanceof ApiError ? err.friendlyMessage : 'Could not load this product.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  function hydrate(product: AdminProduct) {
    setName(product.name);
    setSlug(product.slug);
    setTagline(product.tagline ?? '');
    setDescription(product.description ?? '');
    setScentFamily(product.scentFamily ?? '');
    setStatus(product.status);
    setIsFeatured(product.isFeatured);
    setNotesTop((product.scentNotes?.top ?? []).join(', '));
    setNotesHeart((product.scentNotes?.heart ?? []).join(', '));
    setNotesBase((product.scentNotes?.base ?? []).join(', '));
    setCategoryIds(product.categories.map((c) => c.id));

    // Always show all three sizes, filling in any the product does not have
    // yet — a missing 12ml should be one form field away, not a separate flow.
    const bySize = new Map(product.variants.map((v) => [v.sizeMl, v]));
    setVariants(
      SIZES_ML.map((size) => {
        const existing = bySize.get(size);
        if (!existing) return blankVariant(size);
        return {
          id: existing.id,
          sizeMl: existing.sizeMl,
          sku: existing.sku,
          priceRupees: String(existing.pricePaise / 100),
          compareAtRupees:
            existing.compareAtPaise != null ? String(existing.compareAtPaise / 100) : '',
          stockQty: String(existing.stockQty),
          lowStockThreshold: String(existing.lowStockThreshold),
          isEnabled: existing.isEnabled,
          weightGrams: existing.weightGrams != null ? String(existing.weightGrams) : '',
        };
      })
    );
    setLoading(false);
  }

  const updateVariant = (sizeMl: number, patch: Partial<VariantDraft>) => {
    setVariants((prev) =>
      prev.map((v) => (v.sizeMl === sizeMl ? { ...v, ...patch } : v))
    );
  };

  /* ------------------------------------------------------------- save */

  const save = async () => {
    const token = getToken();
    if (!token) return;

    if (!name.trim()) {
      setError('The fragrance needs a name.');
      return;
    }
    if (!slug.trim()) {
      setError('The fragrance needs a URL slug.');
      return;
    }

    // Only send sizes the admin actually filled in — an empty price means
    // "this size does not exist yet".
    const filled = variants.filter((v) => v.priceRupees.trim() !== '' && v.sku.trim() !== '');

    if (filled.length === 0) {
      setError('Give at least one size a SKU and a price.');
      return;
    }

    const payloadVariants: VariantInput[] = filled.map((v) => ({
      ...(v.id != null ? { id: v.id } : {}),
      sizeMl: v.sizeMl,
      sku: v.sku.trim().toUpperCase(),
      pricePaise: rupeesToPaise(v.priceRupees),
      compareAtPaise: v.compareAtRupees.trim()
        ? rupeesToPaise(v.compareAtRupees)
        : null,
      stockQty: Math.max(0, Math.floor(Number(v.stockQty) || 0)),
      lowStockThreshold: Math.max(0, Math.floor(Number(v.lowStockThreshold) || 0)),
      isEnabled: v.isEnabled,
      weightGrams: v.weightGrams.trim() ? Math.floor(Number(v.weightGrams)) : null,
    }));

    const splitNotes = (value: string) =>
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const payload: ProductInput = {
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      scentFamily: scentFamily.trim() || null,
      scentNotes:
        notesTop || notesHeart || notesBase
          ? {
              top: splitNotes(notesTop),
              heart: splitNotes(notesHeart),
              base: splitNotes(notesBase),
            }
          : null,
      status,
      isFeatured,
      categoryIds,
      variants: payloadVariants,
    };

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      if (isNew) {
        const created = await adminApi.createProduct(token, payload);
        router.replace(`/products/${created.id}`);
      } else {
        await adminApi.updateProduct(token, id, payload);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.friendlyMessage : 'Could not save this product.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <AdminHeading title="Product" />
        <LineSkeleton className="h-96" />
      </div>
    );
  }

  return (
    <div>
      <AdminHeading
        title={isNew ? 'New product' : name || 'Product'}
        description={isNew ? 'Create a fragrance and its sizes.' : `/product/${slug}`}
        action={
          <Link href="/products" className="aw-btn aw-btn-ghost aw-btn-sm">
            ← All products
          </Link>
        }
      />

      <AdminError message={error} />

      {saved ? (
        <p className="mb-5 border border-[color-mix(in_srgb,var(--color-brand-soft)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-brand-soft)_8%,transparent)] px-4 py-3 text-[0.8125rem] text-brand">
          Saved.
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="grid gap-5 lg:grid-cols-3"
      >
        {/* ------------------------------------------------------ details */}
        <div className="space-y-5 lg:col-span-2">
          <AdminCard title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="p-name" className="aw-label">
                  Name <span className="text-accent">*</span>
                </label>
                <input
                  id="p-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    // Auto-slug only while creating, so an existing URL is
                    // never silently changed underneath a live product.
                    if (isNew) {
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '')
                      );
                    }
                  }}
                  disabled={readOnly}
                  className="aw-field"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="p-slug" className="aw-label">
                  URL slug <span className="text-accent">*</span>
                </label>
                <input
                  id="p-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={readOnly}
                  className="aw-field aw-tabular"
                />
                {!isNew ? (
                  <p className="aw-hint">
                    Changing this breaks existing links and search rankings.
                  </p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="p-tagline" className="aw-label">
                  Tagline
                </label>
                <input
                  id="p-tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  disabled={readOnly}
                  maxLength={255}
                  className="aw-field"
                  placeholder="Smoked agarwood, saffron and a long amber close"
                />
              </div>

              <div>
                <label htmlFor="p-family" className="aw-label">
                  Scent family
                </label>
                <input
                  id="p-family"
                  value={scentFamily}
                  onChange={(e) => setScentFamily(e.target.value)}
                  disabled={readOnly}
                  className="aw-field"
                  placeholder="Oud"
                />
              </div>

              <div>
                <label htmlFor="p-status" className="aw-label">
                  Status
                </label>
                <select
                  id="p-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProductStatus)}
                  disabled={readOnly}
                  className="aw-field"
                >
                  <option value="draft">Draft — not visible</option>
                  <option value="active">Active — on sale</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="p-description" className="aw-label">
                  Description
                </label>
                <textarea
                  id="p-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={readOnly}
                  rows={8}
                  className="aw-field resize-y"
                />
                <p className="aw-hint">Markdown. Blank lines separate paragraphs.</p>
              </div>
            </div>
          </AdminCard>

          {/* -------------------------------------- per-size price & stock */}
          <AdminCard title="Sizes, price and stock">
            <p className="mb-4 text-[0.8125rem] text-muted">
              Every size has its own price and its own stock. Leave a size blank to
              leave it out of the catalogue.
            </p>

            <div className="space-y-4">
              {variants.map((variant) => (
                <fieldset
                  key={variant.sizeMl}
                  className="rounded-sm border border-line p-4"
                >
                  <legend className="px-2">
                    <span className="font-[family-name:var(--font-display)] text-lg text-brand">
                      {variant.sizeMl} ml
                    </span>
                  </legend>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label htmlFor={`sku-${variant.sizeMl}`} className="aw-label">
                        SKU
                      </label>
                      <input
                        id={`sku-${variant.sizeMl}`}
                        value={variant.sku}
                        onChange={(e) =>
                          updateVariant(variant.sizeMl, { sku: e.target.value })
                        }
                        disabled={readOnly}
                        className="aw-field aw-tabular uppercase"
                        placeholder={`AWSB-XXX-${String(variant.sizeMl).padStart(2, '0')}`}
                      />
                    </div>

                    <div>
                      <label htmlFor={`price-${variant.sizeMl}`} className="aw-label">
                        Price (₹)
                      </label>
                      <input
                        id={`price-${variant.sizeMl}`}
                        value={variant.priceRupees}
                        onChange={(e) =>
                          updateVariant(variant.sizeMl, {
                            priceRupees: e.target.value.replace(/[^\d.]/g, ''),
                          })
                        }
                        disabled={readOnly}
                        inputMode="decimal"
                        className="aw-field aw-tabular"
                        placeholder="450"
                      />
                      {variant.priceRupees ? (
                        <p className="aw-hint">
                          {formatPaise(rupeesToPaise(variant.priceRupees))}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label htmlFor={`compare-${variant.sizeMl}`} className="aw-label">
                        Was (₹)
                      </label>
                      <input
                        id={`compare-${variant.sizeMl}`}
                        value={variant.compareAtRupees}
                        onChange={(e) =>
                          updateVariant(variant.sizeMl, {
                            compareAtRupees: e.target.value.replace(/[^\d.]/g, ''),
                          })
                        }
                        disabled={readOnly}
                        inputMode="decimal"
                        className="aw-field aw-tabular"
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label htmlFor={`stock-${variant.sizeMl}`} className="aw-label">
                        Stock
                      </label>
                      <input
                        id={`stock-${variant.sizeMl}`}
                        value={variant.stockQty}
                        onChange={(e) =>
                          updateVariant(variant.sizeMl, {
                            stockQty: e.target.value.replace(/[^\d]/g, ''),
                          })
                        }
                        disabled={readOnly}
                        inputMode="numeric"
                        className="aw-field aw-tabular"
                      />
                      <p className="aw-hint">Writes a stock movement.</p>
                    </div>

                    <div>
                      <label htmlFor={`low-${variant.sizeMl}`} className="aw-label">
                        Low-stock alert at
                      </label>
                      <input
                        id={`low-${variant.sizeMl}`}
                        value={variant.lowStockThreshold}
                        onChange={(e) =>
                          updateVariant(variant.sizeMl, {
                            lowStockThreshold: e.target.value.replace(/[^\d]/g, ''),
                          })
                        }
                        disabled={readOnly}
                        inputMode="numeric"
                        className="aw-field aw-tabular"
                      />
                    </div>

                    <div>
                      <label htmlFor={`weight-${variant.sizeMl}`} className="aw-label">
                        Weight (g)
                      </label>
                      <input
                        id={`weight-${variant.sizeMl}`}
                        value={variant.weightGrams}
                        onChange={(e) =>
                          updateVariant(variant.sizeMl, {
                            weightGrams: e.target.value.replace(/[^\d]/g, ''),
                          })
                        }
                        disabled={readOnly}
                        inputMode="numeric"
                        className="aw-field aw-tabular"
                        placeholder="For courier paperwork"
                      />
                    </div>

                    <div className="flex items-end pb-1">
                      <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
                        <input
                          type="checkbox"
                          checked={variant.isEnabled}
                          onChange={(e) =>
                            updateVariant(variant.sizeMl, { isEnabled: e.target.checked })
                          }
                          disabled={readOnly}
                          className="h-4 w-4 accent-[var(--color-brand)]"
                        />
                        Offered for sale
                      </label>
                    </div>
                  </div>
                </fieldset>
              ))}
            </div>
          </AdminCard>
        </div>

        {/* ------------------------------------------------------ sidebar */}
        <div className="space-y-5">
          <AdminCard title="Publishing">
            <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                disabled={readOnly}
                className="h-4 w-4 accent-[var(--color-brand)]"
              />
              Feature on the home page
            </label>

            <div className="mt-5">
              <p className="aw-eyebrow mb-2">Categories</p>
              <div className="space-y-1.5">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex cursor-pointer items-center gap-2 text-[0.8125rem]"
                  >
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(category.id)}
                      onChange={(e) =>
                        setCategoryIds((prev) =>
                          e.target.checked
                            ? [...prev, category.id]
                            : prev.filter((cid) => cid !== category.id)
                        )
                      }
                      disabled={readOnly}
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>
          </AdminCard>

          <AdminCard title="Scent notes">
            <div className="space-y-4">
              {(
                [
                  ['Top', notesTop, setNotesTop],
                  ['Heart', notesHeart, setNotesHeart],
                  ['Base', notesBase, setNotesBase],
                ] as const
              ).map(([label, value, setter]) => (
                <div key={label}>
                  <label htmlFor={`notes-${label}`} className="aw-label">
                    {label}
                  </label>
                  <input
                    id={`notes-${label}`}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    disabled={readOnly}
                    className="aw-field"
                    placeholder="Comma separated"
                  />
                </div>
              ))}
            </div>
          </AdminCard>

          {!readOnly ? (
            <button
              type="submit"
              disabled={saving}
              className="aw-btn aw-btn-primary w-full"
            >
              {saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
            </button>
          ) : (
            <p className="text-xs text-muted">
              Your role can view products but not change them.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
