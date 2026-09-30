import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStaffNames } from "@/lib/staff-names";
import { formatQty, getActiveLocations, isManager } from "../data";
import { MovementList } from "../movement-list";
import { ReorderInput } from "./reorder-input";

export default async function SkuStockPage({ params }: PageProps<"/app/stock/[skuId]">) {
  const staff = await requireStaff();
  const { skuId } = await params;
  if (!z.uuid().safeParse(skuId).success) notFound();

  const supabase = await createClient();
  const [{ data: sku }, locations, { data: levels }, { data: reorders }, { data: movements }] = await Promise.all([
    supabase
      .from("skus")
      .select("id, code, variant_label, barcode, products(id, name, track_batches, units(name, abbreviation))")
      .eq("id", skuId)
      .maybeSingle(),
    getActiveLocations(),
    supabase.from("stock_levels").select("location_id, batch, quantity").eq("sku_id", skuId).neq("quantity", 0),
    supabase.from("reorder_levels").select("location_id, reorder_level").eq("sku_id", skuId),
    supabase
      .from("stock_movements")
      .select("id, created_at, type, quantity, batch, note, created_by, locations(code)")
      .eq("sku_id", skuId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
  ]);
  if (!sku) notFound();

  const product = sku.products;
  const names = await getStaffNames(movements?.map((m) => m.created_by) ?? []);
  const reorder = new Map(reorders?.map((r) => [r.location_id, Number(r.reorder_level)]));
  const manager = isManager(staff.role);
  const total = levels?.reduce((sum, l) => sum + Number(l.quantity), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/stock" className="text-muted text-sm hover:underline">
          ← All stock
        </Link>
        <h2 className="mt-2 text-xl font-semibold">
          {product.name}
          {sku.variant_label && <span className="font-normal"> · {sku.variant_label}</span>}
        </h2>
        <p className="text-muted text-sm">
          <span className="font-mono">{sku.code}</span>
          {sku.barcode && <> · barcode {sku.barcode}</>} · counted in {product.units.name.toLowerCase()}s
          {product.track_batches && " · tracked by batch"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {manager && (
            <Link href={`/app/products/${product.id}`} className="btn btn-secondary">
              Edit product
            </Link>
          )}
          {(manager || staff.role === "warehouse") && (
            <Link href={`/app/stock/labels?sku=${sku.id}`} className="btn btn-secondary">
              Print labels
            </Link>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted border-border border-b text-left">
            <tr>
              <th className="p-3 font-medium">Location</th>
              {product.track_batches && <th className="p-3 font-medium">Batches</th>}
              <th className="p-3 text-right font-medium">In stock</th>
              <th className="p-3 text-right font-medium">Reorder at</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {locations.map((l) => {
              const here = levels?.filter((x) => x.location_id === l.id) ?? [];
              const qty = here.reduce((s, x) => s + Number(x.quantity), 0);
              const min = reorder.get(l.id);
              const low = min !== undefined && qty <= min;
              return (
                <tr key={l.id}>
                  <td className="p-3">
                    {l.name} <span className="text-muted text-xs capitalize">({l.kind})</span>
                  </td>
                  {product.track_batches && (
                    <td className="p-3">
                      {here.length === 0 ? (
                        <span className="text-muted">–</span>
                      ) : (
                        <ul className="flex flex-wrap gap-1">
                          {here.map((b) => (
                            <li key={b.batch} className="bg-background rounded px-2 py-0.5 text-xs">
                              {b.batch || "No batch"}: <strong>{formatQty(Number(b.quantity))}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  )}
                  <td className={`p-3 text-right font-medium tabular-nums ${low ? "text-danger" : ""}`}>
                    {formatQty(qty)}
                  </td>
                  <td className="p-3 text-right">
                    {manager ? (
                      <ReorderInput skuId={sku.id} locationId={l.id} initial={min} />
                    ) : (
                      <span className="text-muted">{min === undefined ? "–" : formatQty(min)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-border border-t font-medium">
            <tr>
              <td className="p-3">Total</td>
              {product.track_batches && <td />}
              <td className="p-3 text-right tabular-nums">
                {formatQty(total)} {product.units.abbreviation}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recent movements</h3>
          <Link href={`/app/stock/history?sku=${sku.id}`} className="text-accent text-sm hover:underline">
            Full history
          </Link>
        </div>
        <MovementList movements={movements ?? []} showBatch={product.track_batches} names={names} />
      </div>
    </div>
  );
}
