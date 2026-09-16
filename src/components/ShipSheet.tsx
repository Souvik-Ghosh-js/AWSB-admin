'use client';

import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useAction } from '@/lib/useApi';
import { trackingUrl } from '@/lib/format';
import { Sheet, Spinner } from '@/components/ui';
import type { AwbScanResult, Courier } from '@/lib/types';

/**
 * Record a shipment.
 *
 * The non-negotiable rule: OCR only ever PRE-FILLS an editable field, shown
 * beside the label photo at full size. Nothing is auto-submitted. A wrong AWB
 * emails a customer a tracking link for someone else's parcel, and nothing
 * downstream will ever catch it — Tesseract routinely confuses 0/O, 1/I/7,
 * 5/S and 8/B on thermal labels that arrive smudged and skewed.
 *
 * Format mismatches WARN, they never block. The admin is holding the label;
 * a rejected legitimate AWB is worse than a typo.
 */
export function ShipSheet({
  open,
  onClose,
  orderId,
  orderNumber,
  onShipped,
}: {
  open: boolean;
  onClose: () => void;
  orderId: number;
  orderNumber: string;
  onShipped: () => void;
}) {
  const { run, busy, error } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);

  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [courierId, setCourierId] = useState<number | ''>('');
  const [awb, setAwb] = useState('');
  const [notes, setNotes] = useState('');
  const [scan, setScan] = useState<AwbScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const token = getToken();
    if (!token) return;
    api.couriers(token).then(
      (list) => setCouriers(list.filter((c) => c.isActive)),
      () => setCouriers([]),
    );
  }, [open]);

  // Revoke the object URL when the preview changes or the sheet closes,
  // otherwise every scan leaks a blob for the life of the tab.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const courier = couriers.find((c) => c.id === courierId) ?? null;
  const cleanAwb = awb.trim().toUpperCase().replace(/\s+/g, '');

  // Warn, never block.
  let formatWarning: string | null = null;
  if (cleanAwb && courier?.awbPattern) {
    try {
      if (!new RegExp(courier.awbPattern).test(cleanAwb)) {
        formatWarning = `That does not match the usual format for ${courier.name}. Check it against the label before sending.`;
      }
    } catch {
      /* A malformed pattern in the couriers table must not break shipping. */
    }
  }

  const resolvedUrl = courier?.supportsDeepLink
    ? trackingUrl(courier.trackingUrlTemplate, cleanAwb)
    : null;

  async function onPickFile(file: File) {
    setScanning(true);
    setScanError(null);
    setScan(null);

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));

    const token = getToken();
    if (!token) return;

    try {
      const result = await api.scanAwb(token, file, courierId || undefined);
      setScan(result);
      // PRE-FILL only. The admin confirms before anything is saved.
      if (result.suggested) setAwb(result.suggested);
      else setScanError(result.message ?? 'Could not read a number. Type it from the label.');
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Scanning failed. Type the number from the label.',
      );
    } finally {
      setScanning(false);
    }
  }

  async function submit() {
    if (!courierId || !cleanAwb) return;
    const ok = await run((t) =>
      api.shipOrder(t, orderId, {
        courierId: Number(courierId),
        trackingNumber: cleanAwb,
        scannedImageUrl: scan?.imageUrl ?? null,
        notes: notes.trim() || null,
        ocr: scan
          ? { suggested: scan.suggested, confidence: scan.confidence, rawText: scan.rawText }
          : null,
      }),
    );
    if (ok !== null) {
      onShipped();
      onClose();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Ship ${orderNumber}`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="ad-btn ad-btn-outline flex-1" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !courierId || cleanAwb.length < 5}
            className="ad-btn ad-btn-primary flex-1"
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Mark shipped
          </button>
        </div>
      }
    >
      {/* courier */}
      <div>
        <label htmlFor="courier" className="ad-label">
          Delivery partner
        </label>
        <select
          id="courier"
          value={courierId}
          onChange={(e) => setCourierId(e.target.value ? Number(e.target.value) : '')}
          className="ad-select"
        >
          <option value="">Choose…</option>
          {couriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.supportsDeepLink ? '' : ' (no tracking link)'}
            </option>
          ))}
        </select>
        {courier && !courier.supportsDeepLink ? (
          <p className="ad-hint">
            {courier.name} cannot be deep-linked. The customer gets the number to copy plus a link to
            the courier&apos;s tracking page.
          </p>
        ) : null}
      </div>

      {/* scan */}
      <div className="mt-5">
        <span className="ad-label">Tracking number</span>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPickFile(f);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="ad-btn ad-btn-outline w-full"
        >
          {scanning ? <Spinner className="h-4 w-4" /> : null}
          {scanning ? 'Reading the label…' : 'Scan the label'}
        </button>

        {preview ? (
          <div className="mt-3">
            {/* Shown at full width on purpose: confirming the number against
                the photo is the whole point of the step. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="The label you photographed"
              className="w-full rounded-md border border-[color:var(--color-line)]"
            />
          </div>
        ) : null}

        {scan?.suggested ? (
          <p className="ad-hint">
            Read from the label
            {scan.confidence != null ? ` (${Math.round(scan.confidence * 100)}% confident)` : ''}.
            Check it against the photo before sending.
          </p>
        ) : null}

        {scanError ? <p className="ad-error">{scanError}</p> : null}

        <input
          type="text"
          value={awb}
          onChange={(e) => setAwb(e.target.value)}
          placeholder="Or type it from the label"
          aria-label="Tracking number"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="ad-input ad-mono mt-3 text-base"
        />

        {scan?.alternatives.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="self-center text-xs text-[color:var(--color-muted)]">Or:</span>
            {scan.alternatives.map((alt) => (
              <button
                key={alt}
                type="button"
                onClick={() => setAwb(alt)}
                className="ad-btn ad-btn-outline ad-btn-sm ad-mono"
              >
                {alt}
              </button>
            ))}
          </div>
        ) : null}

        {formatWarning ? (
          <p className="ad-hint mt-2 font-medium text-[color:var(--color-warn)]">{formatWarning}</p>
        ) : null}

        {resolvedUrl ? (
          <p className="ad-hint mt-2 break-all">
            Customer link: <span className="ad-mono">{resolvedUrl}</span>
          </p>
        ) : null}
      </div>

      {/* notes */}
      <div className="mt-5">
        <label htmlFor="notes" className="ad-label">
          Note (optional, internal)
        </label>
        <input
          id="notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. handed to the pickup boy at 4pm"
          className="ad-input"
        />
      </div>

      <p className="ad-hint mt-5">
        Marking this shipped emails the customer the tracking number straight away.
      </p>

      {error ? <p className="ad-error mt-3">{error}</p> : null}
    </Sheet>
  );
}
