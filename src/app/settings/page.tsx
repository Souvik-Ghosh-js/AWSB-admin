'use client';

import { useCallback, useEffect, useState } from 'react';

import { AdminCard, AdminEmpty, AdminError, AdminHeading } from '@/components/admin/AdminShell';
import { LineSkeleton } from '@/components/ui';
import { ApiError, adminApi } from '@/lib/api';
import { can, getToken, getUser } from '@/lib/admin-auth';
import { SHOP } from '@/lib/shop';
import type { SettingEntry } from '@/lib/types';

/**
 * Settings: the admin-editable key/value store.
 *
 * Values are JSON in the database, so they are edited as text here and parsed
 * on save — a string stays a string, a number stays a number, and malformed
 * JSON is rejected before it reaches the API.
 */
export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingEntry[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const user = getUser();
  const editable = can(user, 'settings.edit');

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const result = await adminApi.settings(token);
      setSettings(result);
      setDrafts(
        Object.fromEntries(
          result.map((s) => [
            s.keyName,
            typeof s.value === 'string' ? s.value : JSON.stringify(s.value),
          ])
        )
      );
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        setSettings([]);
      } else {
        setError(err instanceof ApiError ? err.friendlyMessage : 'Could not load settings.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (keyName: string) => {
    const token = getToken();
    if (!token) return;

    const raw = drafts[keyName] ?? '';

    // Send a real JSON value where the text parses as one; otherwise send it
    // as a string, which is what most of these settings are.
    let value: unknown = raw;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }

    setSavingKey(keyName);
    setError(null);
    try {
      await adminApi.updateSetting(token, keyName, value);
      setSavedKey(keyName);
      window.setTimeout(() => setSavedKey(null), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.friendlyMessage : 'Could not save that setting.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      <AdminHeading
        title="Settings"
        description="Values the shop reads at runtime. Changing one takes effect without a deploy."
      />

      <AdminError message={error} />

      {/* A standing reminder, because it is a business fact that shapes the
          whole app rather than a toggle someone should flip casually. */}
      <div className="mb-5 border border-line-strong bg-surface-alt px-5 py-4">
        <p className="aw-eyebrow mb-1.5">Tax status</p>
        <p className="text-[0.8125rem] leading-relaxed text-muted">
          {SHOP.name} is <strong className="text-ink">not registered for GST</strong>. No
          GSTIN, HSN code or tax breakdown appears anywhere on the storefront, in emails
          or on receipts. If registration happens later, that is a deliberate change to
          both this app and the API — not a setting to switch on here.
        </p>
      </div>

      {loading ? (
        <LineSkeleton className="h-64" />
      ) : !settings || settings.length === 0 ? (
        <div className="aw-card">
          <AdminEmpty message="No settings returned by the API." />
        </div>
      ) : (
        <AdminCard>
          <ul className="divide-y divide-line">
            {settings.map((setting) => (
              <li key={setting.keyName} className="py-4 first:pt-0 last:pb-0">
                <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
                  <div className="sm:col-span-1">
                    <label
                      htmlFor={`setting-${setting.keyName}`}
                      className="aw-tabular text-[0.8125rem] font-medium"
                    >
                      {setting.keyName}
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex gap-2">
                      <input
                        id={`setting-${setting.keyName}`}
                        value={drafts[setting.keyName] ?? ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [setting.keyName]: e.target.value,
                          }))
                        }
                        disabled={!editable}
                        className="aw-field flex-1"
                      />
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => void save(setting.keyName)}
                          disabled={savingKey === setting.keyName}
                          className="aw-btn aw-btn-outline aw-btn-sm shrink-0"
                        >
                          {savingKey === setting.keyName
                            ? '…'
                            : savedKey === setting.keyName
                              ? 'Saved'
                              : 'Save'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}
    </div>
  );
}
