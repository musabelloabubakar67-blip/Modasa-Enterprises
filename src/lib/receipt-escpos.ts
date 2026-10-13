import type { Receipt } from "@/app/app/sales/receipt-data";
import type { BusinessSettings } from "@/lib/business";
import { formatDate, formatDateTime } from "@/lib/dates";
import { EscPos, type PaperWidth } from "@/lib/escpos";
import { formatMoney } from "@/lib/money";
import { formatQty } from "@/lib/quantity";
import { PAYMENT_LABELS } from "@/lib/payments";

const METHOD = PAYMENT_LABELS;

/** The same receipt as ReceiptView, as printer commands. Keep the two in step. */
export function receiptToEscPos(
  sale: Receipt,
  business: BusinessSettings,
  options: { width: PaperWidth; cashierName?: string; openDrawer?: boolean; copyLabel?: string },
) {
  const money = (k: number) => formatMoney(k, business.currency);
  const p = new EscPos(options.width);

  p.align("center").big(true).bold(true);
  p.wrap(business.name, Math.floor(options.width / 2));
  p.big(false).bold(false);
  p.text(sale.locations.name);
  const address = sale.locations.address || business.address;
  const phone = sale.locations.phone || business.phone;
  if (address) p.wrap(address);
  if (phone) p.text(`Tel: ${phone}`);
  if (sale.vat_kobo > 0 && business.vat_number) p.text(`VAT no: ${business.vat_number}`);
  if (options.copyLabel) p.bold(true).text(options.copyLabel).bold(false);

  p.align("left").rule();
  p.text(`Receipt: ${sale.number}`);
  p.text(formatDateTime(sale.created_at));
  if (options.cashierName) p.text(`Served by: ${options.cashierName}`);
  if (sale.customers) p.text(`Customer: ${sale.customers.name}`);
  p.rule();

  for (const l of sale.sale_lines) {
    p.wrap(`${l.skus.products.name}${l.skus.variant_label ? ` - ${l.skus.variant_label}` : ""}`);
    p.row(
      `  ${formatQty(Number(l.quantity))} ${l.skus.products.units.abbreviation} x ${money(l.unit_price_kobo)}${l.batch ? ` B${l.batch}` : ""}`,
      money(l.line_total_kobo),
    );
    if (l.unit_price_kobo < l.list_price_kobo) p.text(`  (sale price, was ${money(l.list_price_kobo)})`);
  }

  p.rule();
  p.row("Subtotal", money(sale.subtotal_kobo));
  if (sale.delivery_fee_kobo > 0) p.row("Delivery", money(sale.delivery_fee_kobo));
  // Double-size text halves the line width.
  p.bold(true)
    .big(true)
    .row("TOTAL", money(sale.total_kobo), Math.floor(options.width / 2))
    .big(false)
    .bold(false);
  if (sale.vat_kobo > 0) p.row(`Incl. VAT ${Number(sale.vat_rate)}%`, money(sale.vat_kobo));
  p.rule();
  for (const pay of sale.sale_payments) {
    p.row(METHOD[pay.method], money(pay.tendered_kobo ?? pay.amount_kobo));
    if (pay.tendered_kobo && pay.tendered_kobo > pay.amount_kobo)
      p.row("Change", money(pay.tendered_kobo - pay.amount_kobo));
  }

  if (sale.returns.length) {
    p.rule();
    for (const r of sale.returns) p.row(`Returned ${r.number}`, `-${money(r.refund_kobo)}`);
    const refunded = sale.returns.reduce((s, r) => s + r.refund_kobo, 0);
    p.bold(true)
      .row("Net paid", money(sale.total_kobo - refunded))
      .bold(false);
  }

  if (sale.fulfilment !== "taken") {
    p.rule();
    if (sale.fulfilment === "collect_later") p.bold(true).text("TO BE COLLECTED - keep this receipt").bold(false);
    else {
      p.bold(true).text("DELIVERY").bold(false);
      if (sale.delivery_address) p.wrap(sale.delivery_address);
      if (sale.delivery_date) p.text(`Date: ${formatDate(sale.delivery_date)}`);
    }
  }

  p.align("center");
  if (business.receipt_footer) {
    p.rule();
    p.wrap(business.receipt_footer);
  }
  p.feed(1).barcode(sale.number).text("Thank you!").feed(3).cut();
  if (options.openDrawer) p.openDrawer();
  return p.toBytes();
}
