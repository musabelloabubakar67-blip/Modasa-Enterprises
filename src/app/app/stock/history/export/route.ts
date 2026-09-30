import { formatDateTime, todayInBusinessZone } from "@/lib/dates";
import Papa from "papaparse";
import { getStaff } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { getStaffNames } from "@/lib/staff-names";
import { MOVEMENT_LABELS } from "../../labels";
import { historyQuery, parseHistoryFilters } from "../query";

export async function GET(request: Request) {
  if (!(await getStaff())) return new Response("Unauthorized", { status: 401 });

  const filters = parseHistoryFilters(Object.fromEntries(new URL(request.url).searchParams));
  const supabase = await createClient();
  const movements = await fetchAll((from, to) => historyQuery(supabase, filters).range(from, to));
  const names = await getStaffNames(movements.map((m) => m.created_by));

  const csv = Papa.unparse({
    fields: ["date_time", "location", "sku_code", "item", "variant", "batch", "type", "quantity_change", "by", "note"],
    data: movements.map((m) => [
      formatDateTime(m.created_at),
      m.locations?.code,
      m.skus?.code,
      m.skus?.products.name,
      m.skus?.variant_label ?? "",
      m.batch,
      MOVEMENT_LABELS[m.type] ?? m.type,
      m.quantity,
      (m.created_by && names.get(m.created_by)) ?? "System",
      m.note ?? "",
    ]),
  });

  const stamp = todayInBusinessZone();
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-history-${stamp}.csv"`,
    },
  });
}
