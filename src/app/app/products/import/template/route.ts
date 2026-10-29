import { getStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { buildProductWorkbook } from "./workbook";

export async function GET() {
  if (!(await getStaff())) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const [categories, units, locations, business] = await Promise.all([
    supabase.from("categories").select("name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("units").select("name").order("sort_order").order("name"),
    supabase.from("locations").select("name, kind").eq("is_active", true).order("kind").order("name"),
    getBusinessSettings(),
  ]);
  if (categories.error) throw categories.error;
  if (units.error) throw units.error;
  if (locations.error) throw locations.error;

  const buffer = await buildProductWorkbook({
    businessName: business.name,
    currency: business.currency,
    categories: categories.data.map((c) => c.name),
    units: units.data.map((u) => u.name),
    locations: locations.data,
  });
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="product-workbook.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
