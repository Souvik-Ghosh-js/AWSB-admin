'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { readPrintShopDetails } from '@/lib/printShop';
import { printWhenImagesReady } from '@/lib/printReady';
import { Invoice, INVOICE_PRINT_CSS } from '@/components/print/Invoice';
import { CardSkeleton, ErrorBox } from '@/components/ui';
import type { OrderDetail, SettingsMap } from '@/lib/types';

/** Bulk invoices — one 4x6in receipt per order, each on its own printed page. */
export default function BulkInvoicePrintPage() {
  return (
    <Suspense fallback={<CardSkeleton rows={3} />}>
      <BulkInvoicePrintInner />
    </Suspense>
  );
}

function BulkInvoicePrintInner() {
  const params = useSearchParams();
  const ids = (params.get('ids') ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  const { data, error, loading } = useApi<{ orders: OrderDetail[]; settings: SettingsMap }>(
    async (t) => {
      const [orders, settings] = await Promise.all([
        Promise.all(ids.map((id) => api.order(t, id))),
        api.settings(t),
      ]);
      return { orders, settings };
    },
    [ids.join(',')],
  );

  useEffect(() => {
    if (data) void printWhenImagesReady();
  }, [data]);

  if (ids.length === 0) return <ErrorBox message="No orders selected." />;
  if (loading) return <CardSkeleton rows={3} />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const shop = readPrintShopDetails(data.settings);

  return (
    <>
      <style>{INVOICE_PRINT_CSS}</style>
      {data.orders.map((order) => (
        <Invoice key={order.id} order={order} shop={shop} />
      ))}
    </>
  );
}
