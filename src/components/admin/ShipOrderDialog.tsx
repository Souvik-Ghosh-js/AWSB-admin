'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { ApiError, USE_MOCKS, adminApi } from '@/lib/api';
import { getToken } from '@/lib/admin-auth';
import { mockCouriers } from '@/lib/mock-data';
import type { AwbScanResult, Courier, ShipOrderInput } from '@/lib/types';

/**
 * Ship an order: pick a courier, then enter the AWB EITHER by typing it OR by
 * photographing the label and letting OCR pre-fill it.
 *
 * The rule this component exists to enforce: the OCR result is NEVER
 * auto-submitted. It lands in an ordinary editable input with the label photo
 * shown beside it at full size, and the admin confirms it. OCR routinely
 * confuses 0/O, 1/I/7, 5/S and 8/B on smudged thermal labels, and a wrong AWB
 * emails the customer a tracking link for somebody else's parcel with nothing
 * downstream to catch it.
 *
 * Format checking WARNS, it never blocks — a rejected legitimate AWB is worse
 * than a typo, and the admin is looking at the physical label anyway.
 */
export function ShipOrderDialog({
  orderId,
  orderNumber,
  onClose,
  onShipped,
}: {
  orderId: number;
  orderNumber: string;
  onClose: () => void;
  onShipped: () => void;
}) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [courierId, setCourierId] = useState<number | null>(null);

  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [scan, setScan] = useState<AwbScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  /** Remembers what OCR proposed, so `was_ocr_edited` can be derived. */
  const [ocrSuggestion, setOcrSuggestion] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const token = getToken();
      if (!token) return;
      try {
        const list = await adminApi.couriers(token);
        setCouriers(list.filter((c) => c.isActive));
      } catch (err) {
        if (USE_MOCKS || (err instanceof ApiError && err.isNetworkError)) {
          setCouriers(mockCouriers.filter((c) => c.isActive));
        } else {
          setError('Could not load the courier list.');
        }
      }
    })();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const courier = couriers.find((c) => c.id === courierId);

  /**
   * Advisory format check against the courier's pattern. Returns a warning
   * string or null — it never gates the submit button.
   */
  const formatWarning = (() => {
    if (!courier?.awbPattern || !trackingNumber.trim()) return null;
    try {
      const normalised = trackingNumber.toUpperCase().replace(/[\s\-–—]/g, '');
      if (new RegExp(courier.awbPattern).test(normalised)) return null;
      return `This does not match the usual format for ${courier.name}. Check it against the label before sending — we will still accept it.`;
    } catch {
      // A malformed pattern in the couriers table must not break shipping.
      return null;
    }
  })();

  const handleScan = async (file: File) => {
    const token = getToken();
    if (!token) return;

    setScanning(true);
    setScanError(null);

    try {
      const result = await adminApi.scanAwb(token, file, courierId ?? undefined);
      setScan(result);

      if (result.suggested) {
        // PRE-FILL, never submit. The admin confirms against the photo.
        setTrackingNumber(result.suggested);
        setOcrSuggestion(result.suggested);
      } else {
        setScanError(
          'We could not read a tracking number from that photo. Please type it from the label.'
        );
      }
    } catch (err) {
      setScanError(
        err instanceof ApiError
          ? err.friendlyMessage
          : 'Could not scan that image. Please type the number instead.'
      );
    } finally {
      setScanning(false);
    }
  };

  const submit = async () => {
    const token = getToken();
    if (!token) return;

    if (!courierId) {
      setError('Choose the courier carrying this parcel.');
      return;
    }
    if (!trackingNumber.trim()) {
      setError('Enter the tracking number from the label.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: ShipOrderInput = {
        courierId,
        trackingNumber: trackingNumber.trim().toUpperCase(),
        entryMethod: ocrSuggestion ? 'scan' : 'manual',
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        // Sent so the API can record was_ocr_edited — the evidence for
        // whether the OCR approach is actually working.
        ...(ocrSuggestion ? { ocrSuggested: ocrSuggestion } : {}),
        ...(scan?.confidence != null ? { ocrConfidence: scan.confidence } : {}),
        ...(scan?.rawText ? { ocrRawText: scan.rawText } : {}),
        ...(scan?.imageUrl ? { scannedImageUrl: scan.imageUrl } : {}),
      };

      await adminApi.shipOrder(token, orderId, payload);
      onShipped();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.friendlyMessage : 'Could not mark this order shipped.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const edited = Boolean(
    ocrSuggestion && trackingNumber.trim().toUpperCase() !== ocrSuggestion.toUpperCase()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--color-ink)_45%,transparent)] p-4 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ship-title"
        className="aw-card w-full max-w-2xl p-6 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="ship-title" className="text-xl">
              Ship {orderNumber}
            </h2>
            <p className="mt-1 text-[0.8125rem] text-muted">
              Pick the courier, then type the AWB or scan the label.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center text-muted hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <hr className="aw-rule mt-4" />

        {/* ---------------------------------------------------- courier */}
        <div className="mt-6">
          <label htmlFor="ship-courier" className="aw-label">
            Courier <span className="text-accent">*</span>
          </label>
          <select
            id="ship-courier"
            value={courierId ?? ''}
            onChange={(e) => setCourierId(e.target.value ? Number(e.target.value) : null)}
            className="aw-field"
          >
            <option value="">Select a courier</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {courier && !courier.supportsDeepLink ? (
            <p className="aw-hint">
              {courier.name} cannot be deep-linked (their tracking page is CAPTCHA-gated).
              The customer&rsquo;s email will show a large copyable number plus a link to
              their tracking page.
            </p>
          ) : null}
        </div>

        {/* ------------------------------------------------ scan option */}
        <div className="mt-6 border-t border-line pt-5">
          <p className="aw-eyebrow mb-3">Read the AWB from the label</p>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleScan(file);
              // Reset so the same file can be chosen again after a bad read.
              e.target.value = '';
            }}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={scanning}
              className="aw-btn aw-btn-outline aw-btn-sm"
            >
              {scanning ? 'Reading label…' : 'Scan or upload label photo'}
            </button>
            {scan ? (
              <button
                type="button"
                onClick={() => {
                  setScan(null);
                  setOcrSuggestion(null);
                  setScanError(null);
                }}
                className="aw-btn aw-btn-ghost aw-btn-sm"
              >
                Clear scan
              </button>
            ) : null}
          </div>

          {scanError ? <p className="aw-error">{scanError}</p> : null}

          {scan ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* The photo stays visible beside the field so confirming takes
                  one glance. */}
              {scan.imageUrl ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-sm border border-line bg-surface-alt">
                  <Image
                    src={scan.imageUrl}
                    alt="Courier label photograph"
                    fill
                    sizes="320px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : null}

              <div className="text-[0.8125rem]">
                <p className="aw-eyebrow mb-2">What OCR read</p>
                <p className="aw-tabular font-[family-name:var(--font-display)] text-xl text-brand">
                  {scan.suggested ?? '—'}
                </p>
                {scan.confidence != null ? (
                  <p className="mt-1 text-xs text-muted">
                    Confidence {(scan.confidence * 100).toFixed(0)}%
                  </p>
                ) : null}

                {scan.alternatives.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs text-muted">Other candidates:</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {scan.alternatives.map((alt) => (
                        <button
                          key={alt}
                          type="button"
                          onClick={() => setTrackingNumber(alt)}
                          className="aw-tabular border border-line-strong px-2 py-1 text-xs transition-colors hover:border-brand"
                        >
                          {alt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Check this against the photo and correct it if needed. Nothing is sent
                  until you confirm below.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* -------------------------------------------- the AWB field */}
        <div className="mt-6 border-t border-line pt-5">
          <label htmlFor="ship-awb" className="aw-label">
            Tracking number (AWB) <span className="text-accent">*</span>
          </label>
          <input
            id="ship-awb"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
            placeholder="Type or confirm the number from the label"
            autoComplete="off"
            className="aw-field aw-tabular font-[family-name:var(--font-display)] text-lg"
          />

          {edited ? (
            <p className="aw-hint">You corrected the scanned number — we record that.</p>
          ) : null}

          {formatWarning ? (
            <p className="mt-2 border border-[color-mix(in_srgb,var(--color-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] px-3 py-2 text-xs text-ink">
              {formatWarning}
            </p>
          ) : null}

          <div className="mt-5">
            <label htmlFor="ship-notes" className="aw-label">
              Internal note
            </label>
            <input
              id="ship-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — not shown to the customer"
              className="aw-field"
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="aw-error mt-4">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !courierId || !trackingNumber.trim()}
            className="aw-btn aw-btn-primary sm:flex-1"
          >
            {submitting ? 'Marking shipped…' : 'Confirm & notify customer'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="aw-btn aw-btn-outline"
          >
            Cancel
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Confirming emails the customer their tracking number and marks the order
          shipped.
        </p>
      </div>
    </div>
  );
}
