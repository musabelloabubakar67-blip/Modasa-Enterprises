"use server";

import { getStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getBusinessSettings } from "@/lib/business";
import { buildProductWorkbook } from "@/app/app/products/import/template/workbook";

function tourAllowed() {
  return (
    process.env.NEXT_PUBLIC_DEMO_TOUR === "1" &&
    !!process.env.DEMO_TOUR_PASSWORD &&
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(env.supabaseUrl)
  );
}

/**
 * Off-camera sign-in for the demo tour, so a scene can start as the right person without typing a password
 * on screen. Inert unless the demo tour is switched on, the database is a local one, and the login is one
 * of the demo accounts made by scripts/demo-setup.mjs.
 */
export async function ensureTourUser(who: string): Promise<{ changed: boolean; error?: string }> {
  const password = process.env.DEMO_TOUR_PASSWORD;
  if (!tourAllowed() || !password || !/^[a-z]+$/.test(who)) {
    return { changed: false, error: "The demo tour isn't switched on here." };
  }
  const email = `${who}@demo.local`;
  const staff = await getStaff();
  // Already them. A cashier's PIN sign-in counts (it is what a cashier has); anyone else needs their password one.
  if (staff?.email === email && (!staff.tillOnly || staff.realRole === "cashier")) return { changed: false };

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { changed: false, error: `Couldn't sign in as ${email}. Run npm run demo:reset.` };
  return { changed: true };
}

/**
 * Files the tour chooses in a file picker, made fresh so they match the current data. "product-workbook" is
 * the real product workbook with four new items filled in (two products, one in a new category).
 */
export async function demoFile(name: string): Promise<{ name: string; type: string; base64: string } | null> {
  if (!tourAllowed() || name !== "product-workbook" || !(await getStaff())) return null;
  const supabase = await createClient();
  const [categories, units, locations, business] = await Promise.all([
    supabase.from("categories").select("name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("units").select("name").order("sort_order").order("name"),
    supabase.from("locations").select("name, kind").eq("is_active", true).order("kind").order("name"),
    getBusinessSettings(),
  ]);
  // Category, product, variant, option 1 name, option 1, option 2 name, option 2, item code, unit, price, sale
  // price, cost, barcode, m², roll width, roll length, description, show on website.
  const rows = [
    ["Bedding", "Duvet Set", "Double", "", "", "", "", "DUV-DBL", "Set", 45000, "", 28000],
    ["Bedding", "Duvet Set", "King", "", "", "", "", "DUV-KNG", "Set", 55000, "", 34000],
    ["Kitchen & Dining", "Table Runner", "Gold", "", "", "", "", "TR-GLD", "Piece", 9500, "", 5200],
    ["Kitchen & Dining", "Table Runner", "Silver", "", "", "", "", "TR-SLV", "Piece", 9500, "", 5200],
  ];
  const buffer = await buildProductWorkbook({
    businessName: business.name,
    currency: business.currency,
    categories: (categories.data ?? []).map((c) => c.name),
    units: (units.data ?? []).map((u) => u.name),
    locations: locations.data ?? [],
    rows,
  });
  return {
    name: "product-workbook.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    base64: Buffer.from(buffer).toString("base64"),
  };
}
