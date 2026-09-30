import type { OrderDetail } from '@/lib/types';
import type { PrintShopDetails } from '@/lib/printShop';

export const LABEL_PRINT_CSS = `
  @page { size: 4in 6in; margin: 0.2in; }
  @media print {
    body { background: #fff !important; }
    .label-page { page-break-after: always; }
    .label-page:last-child { page-break-after: auto; }
  }
  .label-page {
    width: 3.6in;
    min-height: 5.6in;
    margin: 0 auto;
    padding: 16px;
    background: #fff;
    color: #111;
    font-family: Arial, Helvetica, sans-serif;
    box-sizing: border-box;
  }
  .label-header { display: flex; align-items: center; gap: 10px; }
  .label-logo { width: 40px; height: auto; flex-shrink: 0; }
  .label-shop-name { font-size: 15px; font-weight: 700; line-height: 1.2; }
  .label-shop-line { font-size: 10px; color: #444; line-height: 1.35; }
  .label-rule { border-top: 1px dashed #999; margin: 10px 0; }
  .label-block { line-height: 1.4; }
  .label-eyebrow { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #777; margin-bottom: 3px; }
  .label-name { font-size: 14px; font-weight: 700; }
  .label-addr { font-size: 13px; }
  .label-to .label-name { font-size: 18px; }
  .label-to .label-addr { font-size: 15px; }
  .label-addr-lg { font-size: 17px !important; font-weight: 700; }
  .label-footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; }
  .label-order-no { font-size: 14px; font-weight: 700; font-family: monospace; }
  .label-awb { text-align: right; }
  .label-tracking { font-size: 15px; font-weight: 700; font-family: monospace; }
`;

/** One 4x6in shipping label — to/from addresses plus the courier's AWB once shipped. */
export function ShippingLabel({ order, shop }: { order: OrderDetail; shop: PrintShopDetails }) {
  const shipment = order.shipments[0] ?? null;

  return (
    <div className="label-page">
      <header className="label-header">
        {/* eslint-disable-next-line @next/next/no-img-element -- plain img so it renders immediately for print, no Next.js image-loader delay */}
        <img src="/logo-full.png" alt="" width={40} height={49} className="label-logo" />
        <div>
          <p className="label-shop-name">{shop.name}</p>
          <p className="label-shop-line">{[shop.line1, shop.city].filter(Boolean).join(', ')}</p>
          <p className="label-shop-line">{[shop.state, shop.pincode].filter(Boolean).join(' - ')}</p>
          <p className="label-shop-line">Mobile: {shop.phone}</p>
        </div>
      </header>

      <div className="label-rule" />

      <section className="label-block">
        <p className="label-eyebrow">From</p>
        <p className="label-name">{shop.name}</p>
        <p className="label-addr">{shop.line1}</p>
        <p className="label-addr">
          {[shop.city, shop.state, shop.pincode].filter(Boolean).join(', ')}
        </p>
        <p className="label-addr">Mobile: {shop.phone}</p>
      </section>

      <div className="label-rule" />

      <section className="label-block label-to">
        <p className="label-eyebrow">To</p>
        <p className="label-name">{order.shipFullName}</p>
        <p className="label-addr">{order.shipLine1}</p>
        {order.shipLine2 ? <p className="label-addr">{order.shipLine2}</p> : null}
        {order.shipLandmark ? <p className="label-addr">Near {order.shipLandmark}</p> : null}
        <p className="label-addr">
          {[order.shipCity, order.shipDistrict].filter(Boolean).join(', ')}
        </p>
        <p className="label-addr label-addr-lg">
          {[order.shipState, order.shipPincode].filter(Boolean).join(' - ')}
        </p>
        <p className="label-addr">Mobile: {order.shipPhone}</p>
      </section>

      <div className="label-rule" />

      <section className="label-footer">
        <div>
          <p className="label-eyebrow">Order</p>
          <p className="label-order-no">{order.orderNumber}</p>
        </div>
        {shipment ? (
          <div className="label-awb">
            <p className="label-eyebrow">{shipment.courierName}</p>
            <p className="label-tracking">{shipment.trackingNumber}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
