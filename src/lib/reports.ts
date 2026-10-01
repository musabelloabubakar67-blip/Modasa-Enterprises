import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { todayInBusinessZone } from "@/lib/dates";

/** Adds days to a YYYY-MM-DD date (calendar arithmetic, no time zones involved). */
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function dateList(from: string, to: string) {
  return Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
}

/** "1 Oct" for chart axes. */
export function shortDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });
}

export const PRESETS = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  "last-month": "Last month",
} as const;
export type Preset = keyof typeof PRESETS;

export function presetRange(preset: Preset): { from: string; to: string } {
  const today = todayInBusinessZone();
  const firstOfMonth = `${today.slice(0, 8)}01`;
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: firstOfMonth, to: today };
    case "last-month": {
      const lastOfPrev = addDays(firstOfMonth, -1);
      return { from: `${lastOfPrev.slice(0, 8)}01`, to: lastOfPrev };
    }
  }
}

const filtersSchema = z.object({
  preset: z
    .enum(Object.keys(PRESETS) as [Preset, ...Preset[]])
    .optional()
    .catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  shop: z.uuid().optional().catch(undefined),
});

/** Report filters from the URL. Defaults to the last 30 days; ranges are capped at a year. */
export function parseReportFilters(params: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]),
  );
  const f = filtersSchema.parse(flat);
  let { from, to } = f.from && f.to && !f.preset ? { from: f.from, to: f.to } : presetRange(f.preset ?? "30d");
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to) > 366) from = addDays(to, -366);
  return { from, to, shop: f.shop ?? null, preset: f.from && f.to && !f.preset ? null : (f.preset ?? "30d") };
}

export type ReportFilters = ReturnType<typeof parseReportFilters>;

type Client = Awaited<ReturnType<typeof createClient>>;

export async function salesDaily(supabase: Client, from: string, to: string, shop: string | null) {
  const { data, error } = await supabase.rpc("report_sales_daily", {
    p_from: from,
    p_to: to,
    p_location: shop ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function payments(supabase: Client, f: ReportFilters) {
  const { data, error } = await supabase.rpc("report_payments", {
    p_from: f.from,
    p_to: f.to,
    p_location: f.shop ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function products(supabase: Client, f: ReportFilters) {
  const { data, error } = await supabase.rpc("report_products", {
    p_from: f.from,
    p_to: f.to,
    p_location: f.shop ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function slowMovers(supabase: Client, days: number, shop: string | null) {
  const { data, error } = await supabase.rpc("report_slow_movers", { p_days: days, p_location: shop ?? undefined });
  if (error) throw error;
  return data;
}

export async function staff(supabase: Client, f: ReportFilters) {
  const { data, error } = await supabase.rpc("report_staff", {
    p_from: f.from,
    p_to: f.to,
    p_location: f.shop ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function losses(supabase: Client, f: ReportFilters) {
  const { data, error } = await supabase.rpc("report_losses", {
    p_from: f.from,
    p_to: f.to,
    p_location: f.shop ?? undefined,
  });
  if (error) throw error;
  return data;
}

/** Margin as a whole percentage, or null when there's nothing to compare. */
export function marginPercent(revenue: number, cost: number) {
  return revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : null;
}

/** This moment, one week ago (for "last week by this time" comparisons). */
export function oneWeekAgo() {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}
