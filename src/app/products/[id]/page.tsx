'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useAction, useApi } from '@/lib/useApi';
import { money, toPaise, toRupeeInput } from '@/lib/format';
import {
  CardSkeleton, ConfirmSheet, ErrorBox, PageHeader, Spinner, StockPill, Toast,
} from '@/components/ui';
import type { Product, Variant } from '@/lib/types';

const SIZES = [3, 6, 12] as const;

type VariantDraft = {
  id: number | null;
  sizeMl: 3 | 6 | 12;
  price: string;
  stock: string;
  threshold: string;
  enabled: boolean;
};

/**
 * Create or edit a product.
 *
 * `/products/new` and `/products/:id` are the same screen. Splitting them would
 * mean maintaining two copies of a fiddly three-variant form.
 *
 * Stock is edited here for convenience on NEW products only. For existing ones
 * the stock field is read-only and points at Inventory, because every stock
 * change must be written to the ledger with a reason — a silent edit here would
 * be exactly the hole the ledger exists to close.
 */
export default function ProductEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === 'new';
  const id = isNew ? 0 : Number(params.id);

  const { data, error, loading, reload } = useApi<Product | null>(
    (t) => (isNew ? Promise.resolve(null) : api.product(t, id)),
    [id],
  );
  const { run, busy, error: actionError } = useAction();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [scentFamily, setScentFamily] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft');
  const [isFeatured, setIsFeatured] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>(
    SIZES.map((s) => ({ id: null, sizeMl: s, price: '', stock: '0', threshold: '5', enabled: true })),
  );

  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'danger' } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setSlug(data.slug);
    setTagline(data.tagline ?? '');
    setDescription(data.description ?? '');
    setScentFamily(data.scentFamily ?? '');
    setStatus(data.status);
    setIsFeatured(data.isFeatured);
    setVariants(
      SIZES.map((s) => {
        const v: Variant | undefined = data.variants.find((x) => x.sizeMl === s);
        return {
          id: v?.id ?? null,
          sizeMl: s,
          price: toRupeeInput(v?.pricePaise ?? null),
          stock: String(v?.stockQty ?? 0),
          threshold: String(v?.lowStockThreshold ?? 5),
          enabled: v?.isEnabled ?? false,
        };
      }),
    );
  }, [data]);

  if (loading) return <CardSkeleton rows={6} />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const enabledWithPrice = variants.filter((v) => v.enabled && toPaise(v.price) > 0);
  const canSave = name.trim().length >= 2 && enabledWithPrice.length > 0;

  function setVariant(size: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v) => (v.sizeMl === size ? { ...v, ...patch } : v)));
  }

  async function save() {
    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      scent_family: scentFamily.trim() || null,
      status,
      is_featured: isFeatured,
      // Every size is sent, with its enabled flag, so that disabling a size in
      // the form actually disables it on the server. The API matches by size_ml.
      variants: variants.map((v) => ({
        size_ml: v.sizeMl,
        price_paise: toPaise(v.price),
        low_stock_threshold: Number(v.threshold) || 5,
        is_enabled: v.enabled,
        // Stock is only set at creation; afterwards it goes through the ledger.
        ...(isNew ? { stock_qty: Number(v.stock) || 0 } : {}),
      })),
    };

    const result = await run((t) =>
      isNew ? api.createProduct(t, payload) : api.updateProduct(t, id, payload),
    );

    if (result) {
      setToast({ msg: isNew ? 'Product created.' : 'Saved.', tone: 'ok' });
      if (isNew) router.replace(`/products/${result.id}`);
      else reload();
    }
  }

  async function upload(file: File) {
    if (isNew) return;
    setUploading(true);
    const token = getToken();
    if (!token) return;
    try {
      await api.uploadProductImage(token, id, file);
      setToast({ msg: 'Photo added.', tone: 'ok' });
      reload();
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'Upload failed.',
        tone: 'danger',
      });
    } finally {
      setUploading(false);
    }
  }

  async function doDelete() {
    const ok = await run((t) => api.deleteProduct(t, id));
    setDeleteOpen(false);
    if (ok !== null) router.replace('/products');
  }

  return (
    <>
      <div className="mb-4">
        <Link href="/products" className="ad-link text-sm">
          ← All products
        </Link>
      </div>

      <PageHeader title={isNew ? 'New product' : name || 'Product'} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ------------------------------------------------- details */}
          <section className="ad-card p-4">
            <h2 className="mb-4 text-base">Details</h2>

            <div>
              <label htmlFor="name" className="ad-label">Name</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Waalid Shamama"
                className="ad-input"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="tagline" className="ad-label">Tagline</label>
              <input
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="One line shown under the name"
                className="ad-input"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="family" className="ad-label">Scent family</label>
              <input
                id="family"
                value={scentFamily}
                onChange={(e) => setScentFamily(e.target.value)}
                placeholder="Oud, Floral, Musk, Amber…"
                className="ad-input"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="description" className="ad-label">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="How it smells, how it wears, what it is made from."
                className="ad-textarea"
              />
            </div>
          </section>

          {/* ------------------------------------------------- variants */}
          <section className="ad-card p-4">
            <h2 className="text-base">Sizes and prices</h2>
            <p className="ad-hint mb-4">
              Each size has its own price. Turn off any size you do not sell.
            </p>

            <div className="space-y-4">
              {variants.map((v) => (
                <div
                  key={v.sizeMl}
                  className={`rounded-md border p-3 transition-opacity ${
                    v.enabled
                      ? 'border-[color:var(--color-line-strong)]'
                      : 'border-[color:var(--color-line)] opacity-55'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{v.sizeMl}ml</span>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={v.enabled}
                        onChange={(e) => setVariant(v.sizeMl, { enabled: e.target.checked })}
                        className="h-5 w-5 accent-[color:var(--color-brand)]"
                      />
                      Sell this size
                    </label>
                  </div>

                  {v.enabled ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`price-${v.sizeMl}`} className="ad-label">Price (₹)</label>
                        <input
                          id={`price-${v.sizeMl}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="1"
                          value={v.price}
                          onChange={(e) => setVariant(v.sizeMl, { price: e.target.value })}
                          className="ad-input ad-num"
                        />
                      </div>

                      <div>
                        <label htmlFor={`stock-${v.sizeMl}`} className="ad-label">
                          Stock
                        </label>
                        <input
                          id={`stock-${v.sizeMl}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={v.stock}
                          readOnly={!isNew}
                          onChange={(e) => setVariant(v.sizeMl, { stock: e.target.value })}
                          className={`ad-input ad-num ${!isNew ? 'bg-[color:var(--color-surface-alt)]' : ''}`}
                        />
                      </div>

                      <div className="col-span-2">
                        <label htmlFor={`thr-${v.sizeMl}`} className="ad-label">
                          Warn me when stock drops to
                        </label>
                        <input
                          id={`thr-${v.sizeMl}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={v.threshold}
                          onChange={(e) => setVariant(v.sizeMl, { threshold: e.target.value })}
                          className="ad-input ad-num"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {!isNew ? (
              <p className="ad-hint mt-3">
                Stock is changed from <Link href="/inventory" className="ad-link">Inventory</Link> so
                every movement is recorded with a reason.
              </p>
            ) : null}
          </section>

          {/* --------------------------------------------------- photos */}
          {!isNew ? (
            <section className="ad-card p-4">
              <h2 className="text-base">Photos</h2>
              <p className="ad-hint mb-4">
                A phone photo on a windowsill against plain paper is genuinely enough.
              </p>

              {data && data.images.length > 0 ? (
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {data.images.map((img) => (
                    <div key={img.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.altText ?? name}
                        className="aspect-square w-full rounded-md border border-[color:var(--color-line)] object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          run((t) => api.deleteImage(t, img.id)).then((ok) => {
                            if (ok !== null) reload();
                          })
                        }
                        aria-label="Remove photo"
                        className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-danger)] text-white shadow"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="ad-btn ad-btn-outline w-full"
              >
                {uploading ? <Spinner className="h-4 w-4" /> : null}
                {uploading ? 'Uploading…' : 'Add a photo'}
              </button>
            </section>
          ) : null}
        </div>

        {/* ------------------------------------------------- publishing */}
        <div className="space-y-5">
          <section className="ad-card p-4">
            <h2 className="mb-4 text-base">Publishing</h2>

            <div>
              <label htmlFor="status" className="ad-label">Status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="ad-select"
              >
                <option value="draft">Draft — not on the shop</option>
                <option value="active">Active — on sale</option>
                <option value="archived">Archived — hidden</option>
              </select>
            </div>

            <label className="mt-4 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-5 w-5 accent-[color:var(--color-brand)]"
              />
              Show on the home page
            </label>

            {!isNew ? (
              <div className="mt-4">
                <label htmlFor="slug" className="ad-label">Web address</label>
                <input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="ad-input ad-mono"
                />
                <p className="ad-hint">
                  Changing this breaks any link already shared.
                </p>
              </div>
            ) : null}

            {actionError ? <p className="ad-error mt-4">{actionError}</p> : null}

            <button
              type="button"
              onClick={save}
              disabled={busy || !canSave}
              className="ad-btn ad-btn-primary mt-5 w-full"
            >
              {busy ? <Spinner className="h-4 w-4" /> : null}
              {isNew ? 'Create product' : 'Save changes'}
            </button>

            {!canSave ? (
              <p className="ad-hint mt-2">
                Needs a name and at least one size with a price.
              </p>
            ) : null}
          </section>

          {!isNew && data ? (
            <section className="ad-card p-4">
              <h2 className="mb-3 text-base">Stock right now</h2>
              {data.variants.filter((v) => v.isEnabled).map((v) => (
                <div key={v.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm">{v.sizeMl}ml</span>
                  <StockPill qty={v.stockQty} threshold={v.lowStockThreshold} />
                </div>
              ))}
            </section>
          ) : null}

          {!isNew ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="ad-btn ad-btn-outline w-full text-[color:var(--color-danger)]"
            >
              Delete product
            </button>
          ) : null}
        </div>
      </div>

      <ConfirmSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={doDelete}
        busy={busy}
        danger
        title="Delete this product?"
        message="It disappears from the shop. Past orders keep their own copy of the name and price, so order history stays correct."
        confirmLabel="Delete"
      />

      {toast ? <Toast message={toast.msg} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}
