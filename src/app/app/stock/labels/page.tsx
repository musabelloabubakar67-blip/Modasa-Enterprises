import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { LabelSheet, type LabelItem } from "./label-sheet";

const SKU_FIELDS = "id, code, barcode, variant_label, price_kobo, promo_price_kobo, products(name)";

export default async function LabelsPage({ searchParams }: PageProps<"/app/stock/labels">) {
  await requireStaff(["owner", "manager", "warehouse"]);
  const params = await searchParams;
  const receiptId = z.uuid().safeParse(params.receipt).data;
  const skuId = z.uuid().safeParse(params.sku).data;
  const { name, currency } = await getBusinessSettings();
  const supabase = await createClient();

  let initial: LabelItem[] = [];
  let source: string | undefined;

  if (receiptId) {
    const { data: receipt } = await supabase
      .from("receipts")
      .select(`number, receipt_lines(batch, quantity, sort_order, skus(${SKU_FIELDS}))`)
      .eq("id", receiptId)
      .order("sort_order", { referencedTable: "receipt_lines" })
      .maybeSingle();
    if (receipt) {
      source = `One label per item received on delivery ${receipt.number}.`;
      initial = receipt.receipt_lines.map((l) => ({
        sku: toLabelSku(l.skus),
        batch: l.batch,
        // One label per piece; items sold by length/area get a single label.
        copies: Number.isInteger(Number(l.quantity)) ? Number(l.quantity) : 1,
      }));
    }
  } else if (skuId) {
    const { data: sku } = await supabase.from("skus").select(SKU_FIELDS).eq("id", skuId).maybeSingle();
    if (sku) initial = [{ sku: toLabelSku(sku), batch: "", copies: 1 }];
  }

  return <LabelSheet initial={initial} businessName={name} currency={currency} source={source} />;
}

function toLabelSku(s: {
  id: string;
  code: string;
  barcode: string | null;
  variant_label: string | null;
  price_kobo: number;
  promo_price_kobo: number | null;
  products: { name: string };
}): LabelItem["sku"] {
  return {
    id: s.id,
    code: s.code,
    barcode: s.barcode,
    variant_label: s.variant_label,
    price_kobo: s.price_kobo,
    promo_price_kobo: s.promo_price_kobo,
    product_name: s.products.name,
  };
}
