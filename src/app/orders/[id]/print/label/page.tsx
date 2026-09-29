'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { readPrintShopDetails } from '@/lib/printShop';
import { ShippingLabel, LABEL_PRINT_CSS } from '@/components/print/ShippingLabel';
import { CardSkeleton, ErrorBox } from '@/components/ui';
import type { OrderDetail, SettingsMap } from '@/lib/types';

/**
 * Shipping label — 4x6in, the standard courier label size. To/from address
 * pair plus the courier's tracking number, which only exists once the order
 * has actually been shipped (see the print button's gate on the order page).
 */
export default function LabelPrintPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);

  const { data, error, loading } = useApi<{ order: OrderDetail; settings: SettingsMap }>(
    async (t) => {
      const [order, settings] = await Promise.all([api.order(t, orderId), api.settings(t)]);
      return { order, settings };
    },
    [orderId],
  );

  useEffect(() => {
    if (data) {
      // A brief delay lets the print stylesheet and logo image settle before
      // the browser's print dialog captures the page.
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (loading) return <CardSkeleton rows={3} />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <>
      <style>{LABEL_PRINT_CSS}</style>
      <ShippingLabel order={data.order} shop={readPrintShopDetails(data.settings)} />
    </>
  );
}
