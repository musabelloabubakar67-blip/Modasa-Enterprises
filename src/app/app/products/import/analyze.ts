import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { parseMoney } from "@/lib/money";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { ImportRow } from "./columns";

export type RowResult = {
  row: number;
  status: "new" | "update" | "error";
  product: string;
  code: string;
  messages: string[];
};

export type ImportAnalysis = {
  rows: RowResult[];
  summary: {
    newProducts: number;
    updatedProducts: number;
    newSkus: number;
    updatedSkus: number;
    newCategories: string[];
    errors: number;
  };
  /** Ready to pass to the import_products database function. Only meaningful when errors = 0. */
  payload: Json[];
};

type Client = SupabaseClient<Database>;

type Parsed = {
  price: number | null;
  sale: number | null;
  cost: number | null;
  rollWidth?: number;
  rollLength?: number;
  coverage?: number;
  barcode?: string;
};

const lower = (s: string) => s.trim().toLowerCase();

function positive(value: string | undefined, label: string, messages: string[]) {
  if (!value?.trim()) return undefined;
  const n = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) {
    messages.push(`${label} must be a positive number.`);
    return undefined;
  }
  return n;
}

/** "yes"/"no" as people type them in a spreadsheet. undefined = blank, null = not understood. */
function yesNo(value: string | undefined) {
  const v = lower(value ?? "");
  if (!v) return undefined;
  if (["yes", "y", "true", "1", "online"].includes(v)) return true;
  if (["no", "n", "false", "0", "offline"].includes(v)) return false;
  return null;
}

export async function analyzeImport(supabase: Client, input: ImportRow[]): Promise<ImportAnalysis> {
  const [units, categories, products, skus] = await Promise.all([
    fetchAll((a, b) => supabase.from("units").select("id, name, abbreviation").range(a, b)),
    fetchAll((a, b) => supabase.from("categories").select("id, name").range(a, b)),
    fetchAll((a, b) => supabase.from("products").select("id, name").range(a, b)),
    fetchAll((a, b) => supabase.from("skus").select("id, code, barcode, product_id").range(a, b)),
  ]);

  const unitByKey = new Map<string, string>();
  for (const u of units) {
    unitByKey.set(lower(u.name), u.id);
    unitByKey.set(lower(u.abbreviation), u.id);
  }
  const categoryNames = new Set(categories.map((c) => lower(c.name)));
  const productsByName = new Map<string, string[]>();
  for (const p of products) productsByName.set(lower(p.name), [...(productsByName.get(lower(p.name)) ?? []), p.id]);
  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const skuByCode = new Map(skus.map((s) => [lower(s.code), s]));
  const skuByScanCode = new Map(skus.map((s) => [lower(s.barcode ?? s.code), s]));

  const results: RowResult[] = [];
  const groups = new Map<string, { existingId?: string; rows: { row: ImportRow; result: RowResult }[] }>();
  const seenCodes = new Map<string, number>();
  const seenScanCodes = new Map<string, number>();
  const newCategories = new Map<string, string>();
  const parsedRows = new Map<ImportRow, Parsed>();

  for (const row of input) {
    const messages: string[] = [];
    const name = row.product_name?.trim() ?? "";
    const code = row.sku_code?.trim() ?? "";
    const result: RowResult = { row: row._row, status: "new", product: name, code, messages };
    results.push(result);

    if (!name) messages.push("Missing product_name.");
    if (!row.category?.trim()) messages.push("Missing category.");
    if (!row.unit?.trim()) messages.push("Missing unit.");
    else if (!unitByKey.has(lower(row.unit)))
      messages.push(`Unknown unit “${row.unit}”. Use one of: ${units.map((u) => u.name).join(", ")}.`);

    if (!code) messages.push("Missing sku_code.");
    else if (/\s/.test(code)) messages.push("sku_code can't contain spaces.");
    else if (seenCodes.has(lower(code))) messages.push(`sku_code also used on row ${seenCodes.get(lower(code))}.`);
    if (code) seenCodes.set(lower(code), row._row);

    const price = parseMoney(row.price);
    const sale = parseMoney(row.sale_price);
    const cost = parseMoney(row.cost_price);
    if (price === null) messages.push("Missing price.");
    else if (Number.isNaN(price)) messages.push(`Invalid price “${row.price}”.`);
    if (Number.isNaN(sale)) messages.push(`Invalid sale_price “${row.sale_price}”.`);
    else if (sale !== null && price !== null && !Number.isNaN(price) && sale >= price)
      messages.push("sale_price must be below price.");
    if (Number.isNaN(cost)) messages.push(`Invalid cost_price “${row.cost_price}”.`);

    const rollWidth = positive(row.roll_width_cm, "roll_width_cm", messages);
    const rollLength = positive(row.roll_length_cm, "roll_length_cm", messages);
    const coverage = positive(row.coverage_m2, "coverage_m2", messages);

    if (yesNo(row.show_online) === null) messages.push(`show_online must be yes or no, not “${row.show_online}”.`);

    const existing = code ? skuByCode.get(lower(code)) : undefined;
    const barcode = row.barcode?.trim();
    if (barcode && /\s/.test(barcode)) messages.push("barcode can't contain spaces.");
    const scanCode = lower(barcode || code);
    const alreadyFlagged = messages.some((m) => m.startsWith("sku_code also used"));
    if (scanCode && !alreadyFlagged) {
      const clash = skuByScanCode.get(scanCode);
      if (clash && clash.id !== existing?.id)
        messages.push(`Barcode/code “${barcode || code}” already scans as ${clash.code}.`);
      else if (seenScanCodes.has(scanCode))
        messages.push(`Barcode/code also used on row ${seenScanCodes.get(scanCode)}.`);
      seenScanCodes.set(scanCode, row._row);
    }

    // Work out which product this row belongs to.
    let groupKey: string;
    let existingProductId: string | undefined;
    if (existing) {
      result.status = "update";
      existingProductId = existing.product_id;
      groupKey = `id:${existing.product_id}`;
    } else {
      const matches = productsByName.get(lower(name)) ?? [];
      if (matches.length > 1)
        messages.push(`There are ${matches.length} products called “${name}”. Rename one before importing.`);
      existingProductId = matches.length === 1 ? matches[0] : undefined;
      groupKey = existingProductId ? `id:${existingProductId}` : `name:${lower(name)}`;
    }

    const category = row.category?.trim();
    if (category && !categoryNames.has(lower(category)) && !newCategories.has(lower(category)))
      newCategories.set(lower(category), category);

    const group = groups.get(groupKey) ?? { existingId: existingProductId, rows: [] };
    group.rows.push({ row, result });
    groups.set(groupKey, group);

    parsedRows.set(row, { price, sale, cost, rollWidth, rollLength, coverage, barcode });
  }

  const payload: Json[] = [];

  for (const group of groups.values()) {
    const [first] = group.rows;
    const category = lower(first.row.category ?? "");
    const unit = lower(first.row.unit ?? "");
    for (const { row, result } of group.rows.slice(1)) {
      if (lower(row.category ?? "") !== category || lower(row.unit ?? "") !== unit)
        result.messages.push(`Same product as row ${first.row._row} but a different category or unit.`);
    }
    if (group.existingId) {
      const existingName = productNameById.get(group.existingId);
      const newName = first.row.product_name?.trim();
      if (existingName && newName && existingName !== newName)
        first.result.messages.push(`Note: renames “${existingName}” to “${newName}”.`);
    }

    const description = group.rows.map((r) => r.row.description?.trim()).find(Boolean);
    const online = group.rows.map((r) => yesNo(r.row.show_online)).filter((v) => typeof v === "boolean");
    if (new Set(online).size > 1)
      first.result.messages.push("show_online is yes on some rows of this product and no on others.");
    payload.push({
      ...(group.existingId ? { id: group.existingId } : {}),
      name: first.row.product_name?.trim(),
      category_name: first.row.category?.trim(),
      unit_id: unitByKey.get(unit),
      ...(description ? { description } : {}),
      ...(online.length > 0 ? { show_online: online[0] } : {}),
      skus: group.rows.map(({ row }) => {
        const p = parsedRows.get(row)!;
        // Blank optional cells leave existing values alone, so re-importing a partial sheet is safe.
        return {
          code: row.sku_code?.trim(),
          price_kobo: p.price,
          ...(row.variant?.trim() ? { variant_label: row.variant.trim() } : {}),
          ...(p.sale !== null ? { promo_price_kobo: p.sale } : {}),
          ...(p.cost !== null ? { cost_kobo: p.cost } : {}),
          ...(p.barcode ? { barcode: p.barcode } : {}),
          ...(p.rollWidth !== undefined ? { roll_width_cm: p.rollWidth } : {}),
          ...(p.rollLength !== undefined ? { roll_length_cm: p.rollLength } : {}),
          ...(p.coverage !== undefined ? { coverage_m2: p.coverage } : {}),
        };
      }),
    });
  }

  // Notes (prefixed "Note:") are informational; anything else is an error.
  for (const r of results) if (r.messages.some((m) => !m.startsWith("Note:"))) r.status = "error";

  // Count only products that still have at least one valid row.
  const validGroups = [...groups.values()].filter((g) => g.rows.some((r) => r.result.status !== "error"));
  const newProducts = validGroups.filter((g) => !g.existingId).length;
  const updatedProducts = validGroups.length - newProducts;

  return {
    rows: results,
    summary: {
      newProducts,
      updatedProducts,
      newSkus: results.filter((r) => r.status === "new").length,
      updatedSkus: results.filter((r) => r.status === "update").length,
      newCategories: [...newCategories.values()],
      errors: results.filter((r) => r.status === "error").length,
    },
    payload,
  };
}
