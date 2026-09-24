'use client';

import Link from 'next/link';
import { useState } from 'react';

import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { money, variantSize } from '@/lib/format';
import {
  CardSkeleton, EmptyState, ErrorBox, PageHeader, Pagination, StockPill,
} from '@/components/ui';
import type { Page, Product } from '@/lib/types';

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const { data, error, loading, reload } = useApi<Page<Product>>(
    (t) => api.products(t, { page, limit: 20, status: status || undefined, q: query || undefined }),
    [page, status, query],
  );

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Each product has up to three sizes, each with its own price and stock."
        action={
          <Link href="/products/new" className="ad-btn ad-btn-primary">
            Add product
          </Link>
        }
      />

      <div className="mb-4 flex gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
          className="flex flex-1 gap-2"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            aria-label="Search products"
            className="ad-input"
          />
          <button type="submit" className="ad-btn ad-btn-outline shrink-0">
            Search
          </button>
        </form>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
          className="ad-select w-auto shrink-0"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {loading ? (
        <CardSkeleton rows={4} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={query || status ? 'No products match' : 'No products yet'}
          message={
            query || status
              ? 'Try a different search or filter.'
              : 'Add your first attar. You can set a different price and stock level for each bottle size.'
          }
          action={
            <Link href="/products/new" className="ad-btn ad-btn-primary">
              Add your first product
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((p) => {
              const enabled = p.variants.filter((v) => v.isEnabled);
              const outOfStock = enabled.filter((v) => v.stockQty <= 0).length;
              const low = enabled.filter((v) => v.stockQty > 0 && v.stockQty <= v.lowStockThreshold).length;

              return (
                <Link key={p.id} href={`/products/${p.id}`} className="ad-card block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{p.name}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                        {p.scentFamily ?? 'No family'} · {p.images.length} photo
                        {p.images.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span
                      className={`ad-pill shrink-0 ${
                        p.status === 'active'
                          ? 'ad-pill-ok'
                          : p.status === 'draft'
                            ? 'ad-pill-warn'
                            : 'ad-pill-muted'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  {/* Per-size prices are the point of this product model, so they
                      are on the list row rather than hidden one tap deeper. */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {enabled.length === 0 ? (
                      <span className="ad-pill ad-pill-danger">No sizes enabled</span>
                    ) : (
                      enabled.map((v) => (
                        <span
                          key={v.id}
                          className="ad-pill ad-pill-muted ad-num"
                          title={`${v.stockQty} in stock`}
                        >
                          {variantSize(v.sizeMl, v.sizeUnit)} · {money(v.pricePaise, { compact: true })}
                        </span>
                      ))
                    )}
                  </div>

                  {outOfStock > 0 || low > 0 ? (
                    <p className="mt-2 text-xs font-medium text-[color:var(--color-warn)]">
                      {outOfStock > 0 ? `${outOfStock} size${outOfStock === 1 ? '' : 's'} out of stock` : ''}
                      {outOfStock > 0 && low > 0 ? ' · ' : ''}
                      {low > 0 ? `${low} running low` : ''}
                    </p>
                  ) : null}
                </Link>
              );
            })}
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
