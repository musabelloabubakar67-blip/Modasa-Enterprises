import Papa from "papaparse";
import { getStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { losses, parseReportFilters, payments, products, salesDaily, staff } from "@/lib/reports";
import { getStaffNames } from "@/lib/staff-names";
import { createClient } from "@/lib/supabase/server";

const naira = (kobo: number | null) => (kobo === null ? "" : (kobo / 100).toFixed(2));

/** CSV downloads of each report, with the same filters as the page. Owners and managers only. */
export async function GET(request: Request) {
  const me = await getStaff();
  if (!me || (me.role !== "owner" && me.role !== "manager")) return new Response("Forbidden", { status: 403 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const f = parseReportFilters(params);
  const supabase = await createClient();
  const { data: locations } = await supabase.from("locations").select("id, name");
  const where = new Map(locations?.map((l) => [l.id, l.name]));

  let fields: string[] = [];
  let data: (string | number)[][] = [];
  switch (params.report) {
    case "sales": {
      const rows = await salesDaily(supabase, f.from, f.to, f.shop);
      fields = ["date", "shop", "sales", "items", "gross", "refunds", "net"];
      data = rows.map((r) => [
        r.day,
        where.get(r.location_id) ?? "",
        Number(r.sales_count),
        Number(r.items_sold),
        naira(r.gross_kobo),
        naira(r.refunds_kobo),
        naira(r.gross_kobo - r.refunds_kobo),
      ]);
      const pay = await payments(supabase, f);
      data.push([], ["payment method", "received", "refunded", "net"]);
      for (const p of pay)
        data.push([p.method, naira(p.received_kobo), naira(p.refunded_kobo), naira(p.received_kobo - p.refunded_kobo)]);
      break;
    }
    case "products":
    case "profit": {
      const rows = await products(supabase, f);
      fields = [
        "sku_code",
        "item",
        "variant",
        "category",
        "quantity",
        "unit",
        "takings",
        "cost_of_costed_items",
        "takings_of_costed_items",
        "gross_profit",
        "margin_percent",
      ];
      data = rows.map((r) => {
        const profit = Number(r.costed_revenue_kobo) - Number(r.cost_kobo);
        return [
          r.code,
          r.product_name,
          r.variant_label ?? "",
          r.category_name,
          Number(r.quantity),
          r.unit,
          naira(Number(r.revenue_kobo)),
          naira(Number(r.cost_kobo)),
          naira(Number(r.costed_revenue_kobo)),
          Number(r.costed_revenue_kobo) ? naira(profit) : "",
          Number(r.costed_revenue_kobo) ? Math.round((profit / Number(r.costed_revenue_kobo)) * 100) : "",
        ];
      });
      break;
    }
    case "staff": {
      const rows = await staff(supabase, f);
      const names = await getStaffNames(rows.map((r) => r.staff_id));
      fields = [
        "staff",
        "sales",
        "takings",
        "returns",
        "refunded",
        "no_sale_drawer_opens",
        "tills_closed",
        "cash_difference",
      ];
      data = rows.map((r) => [
        names.get(r.staff_id) ?? "Former staff",
        Number(r.sales_count),
        naira(r.sales_kobo),
        Number(r.returns_count),
        naira(r.returns_kobo),
        Number(r.drawer_openings),
        Number(r.sessions_closed),
        naira(r.cash_difference_kobo),
      ]);
      break;
    }
    case "losses": {
      const rows = await losses(supabase, f);
      fields = ["when", "type", "where", "sku_code", "item", "variant", "quantity", "value", "reason"];
      data = rows.map((r) => [
        r.happened_at ? formatDateTime(r.happened_at) : "",
        r.kind,
        where.get(r.location_id) ?? "",
        r.code,
        r.product_name,
        r.variant_label ?? "",
        Number(r.quantity),
        naira(r.value_kobo),
        r.reason ?? "",
      ]);
      break;
    }
    default:
      return new Response("Unknown report", { status: 400 });
  }

  const csv = Papa.unparse({ fields, data });
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.report}-${f.from}-to-${f.to}.csv"`,
    },
  });
}
