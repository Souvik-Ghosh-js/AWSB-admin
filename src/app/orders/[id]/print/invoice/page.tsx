'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { readPrintShopDetails } from '@/lib/printShop';
import { Invoice, INVOICE_PRINT_CSS } from '@/components/print/Invoice';
import { CardSkeleton, ErrorBox } from '@/components/ui';
import type { OrderDetail, SettingsMap } from '@/lib/types';

/**
 * Invoice / billing printout — 4x6in, same label stock as the shipping label.
 * No GST/HSN/tax anywhere: the shop is not GST registered, so this is a plain
 * receipt of what was charged, not a tax invoice.
 */
export default function InvoicePrintPage() {
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
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (loading) return <CardSkeleton rows={3} />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <>
      <style>{INVOICE_PRINT_CSS}</style>
      <Invoice order={data.order} shop={readPrintShopDetails(data.settings)} />
    </>
  );
}
