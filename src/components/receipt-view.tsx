import type { BusinessSettings } from "@/lib/business";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import type { Receipt } from "@/app/app/sales/receipt-data";
import { PAYMENT_LABELS } from "@/lib/payments";

const METHOD = PAYMENT_LABELS;

/** An 80mm-wide receipt. Used for printing at the till and for the customer's online receipt. */
export function ReceiptView({
  sale,
  business,
  cashierName,
}: {
  sale: Receipt;
  business: BusinessSettings;
  cashierName?: string;
}) {
  const money = (k: number) => formatMoney(k, business.currency);
  const refunded = sale.returns.reduce((s, r) => s + r.refund_kobo, 0);

  return (
    <div className="receipt mx-auto w-[72mm] bg-white font-mono text-[11px] leading-snug text-black">
      <div className="text-center">
        <p className="text-sm font-bold">{business.name}</p>
        <p>{sale.locations.name}</p>
        {(sale.locations.address || business.address) && <p>{sale.locations.address || business.address}</p>}
        {(sale.locations.phone || business.phone) && <p>Tel: {sale.locations.phone || business.phone}</p>}
        {sale.vat_kobo > 0 && business.vat_number && <p>VAT no: {business.vat_number}</p>}
      </div>

      <Rule />
      <p>Receipt: {sale.number}</p>
      <p>{formatDateTime(sale.created_at)}</p>
      {cashierName && <p>Served by: {cashierName}</p>}
      {sale.customers && <p>Customer: {sale.customers.name}</p>}
      <Rule />

      {sale.sale_lines.map((l) => (
        <div key={l.id} className="mb-1">
          <p>
            {l.skus.products.name}
            {l.skus.variant_label && ` · ${l.skus.variant_label}`}
          </p>
          <div className="flex justify-between">
            <span>
              {formatQty(Number(l.quantity))} {l.skus.products.units.abbreviation} × {money(l.unit_price_kobo)}
              {l.batch && ` · B${l.batch}`}
            </span>
            <span>{money(l.line_total_kobo)}</span>
          </div>
          {l.unit_price_kobo < l.list_price_kobo && <p> (sale price, was {money(l.list_price_kobo)})</p>}
        </div>
      ))}

      <Rule />
      <Row label="Subtotal" value={money(sale.subtotal_kobo)} />
      {sale.delivery_fee_kobo > 0 && <Row label="Delivery" value={money(sale.delivery_fee_kobo)} />}
      <Row label="TOTAL" value={money(sale.total_kobo)} bold />
      {sale.vat_kobo > 0 && <Row label={`Incl. VAT ${Number(sale.vat_rate)}%`} value={money(sale.vat_kobo)} />}
      <Rule />
      {sale.sale_payments.map((p, i) => (
        <div key={i}>
          <Row label={METHOD[p.method]} value={money(p.tendered_kobo ?? p.amount_kobo)} />
          {p.tendered_kobo && p.tendered_kobo > p.amount_kobo && (
            <Row label="Change" value={money(p.tendered_kobo - p.amount_kobo)} />
          )}
        </div>
      ))}

      {sale.returns.length > 0 && (
        <>
          <Rule />
          {sale.returns.map((r) => (
            <Row key={r.number} label={`Returned ${r.number}`} value={`-${money(r.refund_kobo)}`} />
          ))}
          <Row label="Net paid" value={money(sale.total_kobo - refunded)} bold />
        </>
      )}

      {sale.fulfilment !== "taken" && (
        <>
          <Rule />
          {sale.fulfilment === "collect_later" ? (
            <p className="font-bold">TO BE COLLECTED — keep this receipt</p>
          ) : (
            <>
              <p className="font-bold">DELIVERY</p>
              <p>{sale.delivery_address}</p>
              {sale.delivery_date && <p>Date: {formatDate(sale.delivery_date)}</p>}
            </>
          )}
        </>
      )}

      {business.receipt_footer && (
        <>
          <Rule />
          <p className="text-center">{business.receipt_footer}</p>
        </>
      )}
      <p className="mt-2 text-center">Thank you!</p>
    </div>
  );
}

function Rule() {
  return <p className="my-1 overflow-hidden whitespace-nowrap">{"-".repeat(48)}</p>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-[13px] font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
