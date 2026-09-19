'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/useApi';
import {
  CardSkeleton, ConfirmSheet, EmptyState, ErrorBox, PageHeader, Sheet, Spinner, Toast,
} from '@/components/ui';
import type { Category } from '@/lib/types';

/**
 * Product categories (Attars, Powders, Bakhoor, Dhoopbatti, ...).
 *
 * This is a real taxonomy, separate from scent_family — scent_family is a
 * free-text note on attars only (Oud, Floral, Musk...), while categories are
 * what makes a powder or a bakhoor blend NOT show up wherever the storefront
 * says "Attars". A product not sorted into a category still exists and can
 * still be edited, it just won't appear under any of the storefront's
 * /shop?category= filters.
 */
export default function CategoriesPage() {
  const { data, error, loading, reload } = useApi<Category[]>((t) => api.categories(t));
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="What kind of product this is — Attars, Powders, Bakhoor, Dhoopbatti. A product only shows up under a category once it's assigned to one, from its own editor page."
        action={
          <button type="button" onClick={() => setEditing('new')} className="ad-btn ad-btn-primary">
            Add category
          </button>
        }
      />

      {loading ? (
        <CardSkeleton rows={4} />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No categories yet" message="Add your first one, e.g. Attars." />
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <div key={c.id} className="ad-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  {c.description ? (
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">{c.description}</p>
                  ) : null}
                  <p className="ad-mono mt-1.5 text-xs text-[color:var(--color-muted)]">/{c.slug}</p>
                </div>
                <span className="ad-pill ad-pill-muted shrink-0">
                  {c.productCount} {c.productCount === 1 ? 'product' : 'products'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setEditing(c)}
                className="ad-btn ad-btn-outline ad-btn-sm mt-3"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <CategorySheet
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setToast(msg);
            reload();
          }}
        />
      ) : null}

      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}

function CategorySheet({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { run, busy, error } = useAction();
  const { run: runDelete, busy: deleting, error: deleteError } = useAction();
  const isNew = !category;

  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function save() {
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
    };
    const ok = await run((t) =>
      isNew ? api.createCategory(t, payload) : api.updateCategory(t, category.id, payload),
    );
    if (ok !== null) {
      onSaved(isNew ? `${payload.name} added.` : `${payload.name} saved.`);
      onClose();
    }
  }

  async function remove() {
    if (!category) return;
    const ok = await runDelete((t) => api.deleteCategory(t, category.id));
    setConfirmDeleteOpen(false);
    if (ok !== null) {
      onSaved(`${category.name} deleted.`);
      onClose();
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'Add category' : `Edit ${category.name}`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="ad-btn ad-btn-outline flex-1" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || name.trim().length < 2}
            className="ad-btn ad-btn-primary flex-1"
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Save
          </button>
        </div>
      }
    >
      <div>
        <label htmlFor="catname" className="ad-label">Name</label>
        <input id="catname" value={name} onChange={(e) => setName(e.target.value)} className="ad-input" />
      </div>

      <div className="mt-4">
        <label htmlFor="catdesc" className="ad-label">Description (optional)</label>
        <textarea
          id="catdesc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="ad-input"
        />
      </div>

      {error ? <p className="ad-error mt-3">{error}</p> : null}

      {!isNew ? (
        <div className="mt-6 border-t border-[color:var(--color-line)] pt-4">
          {category.productCount > 0 ? (
            <p className="text-xs text-[color:var(--color-muted)]">
              Can&rsquo;t delete — {category.productCount}{' '}
              {category.productCount === 1 ? 'product is' : 'products are'} still assigned to this
              category. Reassign them first, from each product&rsquo;s editor page.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="ad-btn ad-btn-outline ad-btn-sm text-[color:var(--color-danger)]"
            >
              Delete category
            </button>
          )}
          {deleteError ? <p className="ad-error mt-2">{deleteError}</p> : null}
        </div>
      ) : null}

      {category ? (
        <ConfirmSheet
          open={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={remove}
          title="Delete category"
          message={`Delete "${category.name}"? This can't be undone.`}
          confirmLabel="Delete"
          danger
          busy={deleting}
        />
      ) : null}
    </Sheet>
  );
}
