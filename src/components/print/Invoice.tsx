import { money, dateOnly, variantSize } from '@/lib/format';
import type { OrderDetail } from '@/lib/types';
import type { PrintShopDetails } from '@/lib/printShop';

export const INVOICE_PRINT_CSS = `
  @page { size: 4in 6in; margin: 0.2in; }
  @media print {
    body { background: #fff !important; }
    .inv-page { page-break-after: always; }
    .inv-page:last-child { page-break-after: auto; }
  }
  .inv-page {
    width: 3.6in;
    margin: 0 auto;
    padding: 16px;
    background: #fff;
    color: #111;
    font-family: Arial, Helvetica, sans-serif;
    box-sizing: border-box;
    font-size: 11px;
  }
  .inv-header { display: flex; align-items: center; gap: 8px; }
  .inv-logo { width: 34px; height: auto; flex-shrink: 0; }
  .inv-shop-name { font-size: 14px; font-weight: 700; line-height: 1.2; }
  .inv-shop-line { font-size: 9px; color: #444; line-height: 1.3; }
  .inv-rule { border-top: 1px solid #333; margin: 10px 0; }
  .inv-meta { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
  .inv-eyebrow { font-size: 8.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #777; }
  .inv-bill-name { font-size: 12px; font-weight: 700; margin-top: 2px; }
  .inv-bill-line { font-size: 10px; line-height: 1.35; }
  .inv-meta-right { text-align: right; font-size: 10px; line-height: 1.6; }
  .inv-meta-right .inv-eyebrow { display: inline-block; width: 40px; text-align: left; }
  .inv-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .inv-table thead th {
    text-align: left; font-size: 8.5px; letter-spacing: 0.05em; text-transform: uppercase;
    color: #777; border-bottom: 1px solid #333; padding: 4px 2px;
  }
  .inv-table td { padding: 5px 2px; border-bottom: 1px solid #ddd; font-size: 10.5px; vertical-align: top; }
  .inv-item-size { color: #777; font-size: 9px; }
  .inv-num { text-align: right; white-space: nowrap; }
  .inv-totals { margin-top: 8px; }
  .inv-total-row { display: flex; justify-content: space-between; padding: 2px 2px; font-size: 10.5px; }
  .inv-grand-total { border-top: 1px solid #333; margin-top: 4px; padding-top: 6px; font-size: 13px; font-weight: 700; }
  .inv-footnote { margin-top: 14px; font-size: 8px; color: #888; line-height: 1.4; }
`;

/** One 4x6in billing receipt — no GST/HSN/tax, the shop is not GST registered. */
export function Invoice({ order, shop }: { order: OrderDetail; shop: PrintShopDetails }) {
  return (
    <div className="inv-page">
      <header className="inv-header">
        {/* eslint-disable-next-line @next/next/no-img-element -- plain img so it renders immediately for print, no Next.js image-loader delay */}
        <img src="/logo-full.png" alt="" width={34} height={42} className="inv-logo" />
        <div>
          <p className="inv-shop-name">{shop.name}</p>
          <p className="inv-shop-line">{[shop.line1, shop.city].filter(Boolean).join(', ')}</p>
          <p className="inv-shop-line">
            {[shop.state, shop.pincode].filter(Boolean).join(' - ')} · Mobile: {shop.phone}
          </p>
        </div>
      </header>

      <div className="inv-rule" />

      <section className="inv-meta">
        <div>
          <p className="inv-eyebrow">Invoice for</p>
          <p className="inv-bill-name">{order.shipFullName}</p>
          <p className="inv-bill-line">{order.shipLine1}</p>
          {order.shipLine2 ? <p className="inv-bill-line">{order.shipLine2}</p> : null}
          <p className="inv-bill-line">
            {[order.shipCity, order.shipState, order.shipPincode].filter(Boolean).join(', ')}
          </p>
          <p className="inv-bill-line">Mobile: {order.shipPhone}</p>
        </div>
        <div className="inv-meta-right">
          <p><span className="inv-eyebrow">Order</span> {order.orderNumber}</p>
          <p><span className="inv-eyebrow">Date</span> {dateOnly(order.placedAt ?? order.createdAt)}</p>
        </div>
      </section>

      <table className="inv-table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="inv-num">Qty</th>
            <th className="inv-num">Rate</th>
            <th className="inv-num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.productName}
                <span className="inv-item-size"> · {variantSize(item.sizeMl, item.sizeUnit)}</span>
              </td>
              <td className="inv-num">{item.quantity}</td>
              <td className="inv-num">{money(item.unitPricePaise, { compact: true })}</td>
              <td className="inv-num">{money(item.lineTotalPaise, { compact: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-totals">
        <div className="inv-total-row">
          <span>Subtotal</span>
          <span>{money(order.subtotalPaise, { compact: true })}</span>
        </div>
        {order.discountPaise > 0 ? (
          <div className="inv-total-row">
            <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
            <span>−{money(order.discountPaise, { compact: true })}</span>
          </div>
        ) : null}
        <div className="inv-total-row">
          <span>Shipping</span>
          <span>{order.shippingPaise === 0 ? 'Free' : money(order.shippingPaise, { compact: true })}</span>
        </div>
        <div className="inv-total-row inv-grand-total">
          <span>Total</span>
          <span>{money(order.totalPaise, { compact: true })}</span>
        </div>
      </div>

      <p className="inv-footnote">
        Not a GST invoice — {shop.name} is not GST registered. This is a receipt of the amount charged.
      </p>
    </div>
  );
}
