'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AdminEmpty, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton } from '@/components/ui';
import { ApiError, USE_MOCKS, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { formatPaise } from '@/lib/format';
import { mockProducts } from '@/lib/mock-data';
import type { AdminProduct } from '@/lib/types';

/**
 * Products list.
 *
 * The stock column shows EVERY size, because stock is per-variant: "12 in
 * stock" is meaningless when the 3ml has 40 and the 12ml has none.
 */
/**
 * Stable timestamp for mock fallback rows. See the note at its use site: any
 * clock read during render differs between the server pass and the client
 * pass and breaks hydration.
 */
const MOCK_TIMESTAMP = '2026-09-01T00:00:00.000Z';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const user = getUser();

  useEffect(() => {
    void (async () => {
      const token = getToken();
      if (!token) return;

      try {
        const result = await adminApi.products(token, { limit: 60 });
        setProducts(result.items ?? []);
      } catch (err) {
        if (USE_MOCKS || (err instanceof ApiError && err.isNetworkError)) {
          // Shape the public mocks into the admin view, which carries raw stock.
          setProducts(
            mockProducts.map((p) => ({
              id: p.id,
              slug: p.slug,
              name: p.name,
              tagline: p.tagline,
              description: p.description,
              scentFamily: p.scentFamily,
              scentNotes: p.scentNotes,
              status: 'active' as const,
              isFeatured: p.isFeatured,
              sortOrder: 0,
              metaTitle: p.metaTitle,
              metaDescription: p.metaDescription,
              images: p.images,
              variants: p.variants.map((v) => ({
                id: v.id,
                productId: p.id,
                sizeMl: v.sizeMl,
                sku: v.sku,
                pricePaise: v.pricePaise,
                compareAtPaise: v.compareAtPaise,
                stockQty: v.inStock ? (v.isLowStock ? 3 : 24) : 0,
                lowStockThreshold: 5,
                isEnabled: true,
                weightGrams: null,
              })),
              categories: p.categories,
              // A FIXED timestamp, not new Date(): these pages are client
              // components that Next still server-renders, so a clock read
              // here produces one value on the server and another in the
              // browser — which is exactly the "Hydration failed because the
              // server rendered HTML didn't match the client" error the dev
              // overlay was reporting on every admin screen. Mock rows are
              // display-only fallbacks, so a constant is honest here.
              createdAt: MOCK_TIMESTAMP,
              updatedAt: MOCK_TIMESTAMP,
            }))
          );
        } else {
          setError(
            err instanceof ApiError ? err.friendlyMessage : 'Could not load products.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <AdminHeading
        title="Products"
        description="Each fragrance and its three sizes."
        action={
          can(user, 'products.edit') ? (
            <Link href="/products/new" className="aw-btn aw-btn-primary aw-btn-sm">
              New product
            </Link>
          ) : null
        }
      />

      <AdminError message={error} />

      <div className="aw-card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <LineSkeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !products || products.length === 0 ? (
          <AdminEmpty message="No products yet. Create your first fragrance." />
        ) : (
          <div className="overflow-x-auto">
            <table className="aw-table">
              <thead>
                <tr className="border-b border-line bg-surface-alt">
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Fragrance</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Family</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Sizes, price &amp; stock</th>
                  <th scope="col" className="aw-eyebrow px-4 py-3 text-[0.5625rem]">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-line transition-colors last:border-0 hover:bg-surface-alt"
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/products/${product.id}`}
                        className="text-[0.875rem] font-medium text-brand underline-offset-4 hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs text-muted">/{product.slug}</p>
                      {product.isFeatured ? (
                        <span className="aw-badge mt-1 bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[#8a6c26]">
                          Featured
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Family" className="px-4 py-3 align-top text-[0.8125rem] text-muted">
                      {product.scentFamily ?? '—'}
                    </td>
                    <td data-label="Sizes" className="px-4 py-3 align-top">
                      <ul className="space-y-1">
                        {[...product.variants]
                          .sort((a, b) => a.sizeMl - b.sizeMl)
                          .map((variant) => (
                            <li
                              key={variant.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span className="aw-tabular w-12 shrink-0 text-muted">
                                {variant.sizeMl} ml
                              </span>
                              <span className="aw-tabular w-16 shrink-0">
                                {formatPaise(variant.pricePaise, { compact: true })}
                              </span>
                              <span
                                className={`aw-tabular ${
                                  variant.stockQty === 0
                                    ? 'text-danger'
                                    : variant.stockQty <= variant.lowStockThreshold
                                      ? 'text-[#8a6c26]'
                                      : 'text-muted'
                                }`}
                              >
                                {variant.stockQty} in stock
                              </span>
                              {!variant.isEnabled ? (
                                <span className="text-muted">· hidden</span>
                              ) : null}
                            </li>
                          ))}
                      </ul>
                    </td>
                    <td data-label="Status" className="px-4 py-3 align-top">
                      <span
                        className={`aw-badge ${
                          product.status === 'active'
                            ? 'bg-[color-mix(in_srgb,var(--color-brand-soft)_14%,transparent)] text-brand-soft'
                            : 'bg-surface-alt text-muted'
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
