import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getActiveLocations, isManager } from "../../stock/data";
import { createClient } from "@/lib/supabase/server";
import { TransferForm, type Line } from "../transfer-form";

export default async function NewTransferPage({ searchParams }: PageProps<"/app/transfers/new">) {
  const staff = await requireStaff();
  const params = await searchParams;
  const locations = await getActiveLocations();
  const ids = locations.map((l) => l.id);
  const valid = (v: unknown) => (z.uuid().safeParse(v).success && ids.includes(v as string) ? (v as string) : "");
  const firstWarehouse = locations.find((l) => l.kind === "warehouse")?.id ?? "";
  const mine = staff.locationId && ids.includes(staff.locationId) ? staff.locationId : "";

  // Sensible defaults: shops request from a warehouse; warehouse staff send to a shop.
  let from = valid(params.from);
  let to = valid(params.to);
  if (to && !from) from = locations.find((l) => l.kind === "warehouse" && l.id !== to)?.id ?? "";
  if (!from && !to) {
    const here = locations.find((l) => l.id === mine);
    if (here?.kind === "warehouse") {
      from = here.id;
      to = locations.find((l) => l.kind === "shop")?.id ?? "";
    } else {
      to = mine;
      from = firstWarehouse;
    }
  }

  // Pre-fill one item when coming from the till ("Request it for this shop").
  const initialLines: Line[] = [];
  const skuId = z.uuid().safeParse(params.sku).data;
  if (skuId) {
    const supabase = await createClient();
    const { data: s } = await supabase
      .from("skus")
      .select(
        "id, code, barcode, variant_label, price_kobo, promo_price_kobo, products(name, track_batches, units(abbreviation, allows_decimal))",
      )
      .eq("id", skuId)
      .maybeSingle();
    const qty = Number(params.qty);
    if (s)
      initialLines.push({
        sku: {
          id: s.id,
          code: s.code,
          barcode: s.barcode,
          variant_label: s.variant_label,
          price_kobo: s.price_kobo,
          promo_price_kobo: s.promo_price_kobo,
          product_name: s.products.name,
          unit: s.products.units.abbreviation,
          allows_decimal: s.products.units.allows_decimal,
          track_batches: s.products.track_batches,
        },
        quantity: qty > 0 ? String(qty) : "1",
      });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/app/transfers" className="text-muted text-sm hover:underline">
        ← Transfers
      </Link>
      <h1 className="text-2xl font-semibold">New transfer</h1>
      {!isManager(staff.role) && (
        <p className="text-muted text-sm">
          You can request stock for your location, or send stock from it. The other location confirms when it arrives.
        </p>
      )}
      <TransferForm
        locations={locations}
        initialFrom={from === to ? "" : from}
        initialTo={to}
        initialLines={initialLines}
      />
    </div>
  );
}
