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

/** A unit the file uses that doesn't exist yet; created on import, before the products. */
export type NewUnit = {
  name: string;
  abbreviation: string;
  /** From the size columns of its rows: roll width/length → roll, m² per unit → area. */
  coverage: "none" | "roll" | "area";
};

export type ImportAnalysis = {
  rows: RowResult[];
  summary: {
    newProducts: number;
    updatedProducts: number;
    newSkus: number;
    updatedSkus: number;
    newCategories: string[];
    /** Created as whole-number units; tick "Allow decimals" afterwards for ones sold in fractions. */
    newUnits: NewUnit[];
    errors: number;
  };
  /**
   * Ready to pass to the import_products database function. Only meaningful when errors = 0. Products in a
   * new unit carry `unit_name` instead of `unit_id` until commitImport has created the unit.
   */
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

/** Unit names as compared for typos: "Square metre", "square-metre" and "squaremetre" are the same. */
const squash = (s: string) => lower(s).replace(/[^a-z0-9]/g, "");

/** Edits (insert, delete, change, swap two neighbours) to turn a into b. "Peice" → "Piece" is 1. */
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/**
 * The existing unit a new-looking name is probably a typo of: same letters ignoring spaces and
 * punctuation, a plural ("Pieces"), or one slip ("Peice"; two in long names). Short abbreviations like
 * "m" are left out, or every short word would look like a typo.
 */
function likelyTypo(name: string, units: { name: string; abbreviation: string }[]) {
  const n = squash(name);
  for (const u of units) {
    for (const known of [u.name, u.abbreviation]) {
      const k = squash(known);
      if (k.length < 3) continue;
      if (n === k || n === `${k}s` || n === `${k}es` || k === `${n}s`) return u.name;
      if (Math.min(n.length, k.length) >= 4 && editDistance(n, k) <= (k.length >= 8 ? 2 : 1)) return u.name;
    }
  }
  return null;
}

/** A short form for a new unit: the name itself when short ("bag", "sheet"), else its start ("pack."). */
function abbreviate(name: string, taken: Set<string>) {
  const letters = lower(name).replace(/[^a-z0-9]/g, "");
  const base = letters.length <= 6 ? letters : `${letters.slice(0, 4)}.`;
  let abbr = base || "unit";
  for (let i = 2; taken.has(abbr); i++) abbr = `${base}${i}`;
  return abbr;
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
  // New units by lower-cased name: what the file calls it, and the size columns its rows fill.
  const newUnits = new Map<string, { name: string; roll: boolean; area: boolean; rows: RowResult[] }>();
  const parsedRows = new Map<ImportRow, Parsed>();

  for (const row of input) {
    const messages: string[] = [];
    const name = row.product_name?.trim() ?? "";
    const code = row.sku_code?.trim() ?? "";
    const result: RowResult = { row: row._row, status: "new", product: name, code, messages };
    results.push(result);

    if (!name) messages.push("Missing product_name.");
    if (!row.category?.trim()) messages.push("Missing category.");
    const unitName = row.unit?.trim() ?? "";
    if (!unitName) messages.push("Missing unit.");
    else if (!unitByKey.has(lower(unitName))) {
      const typo = likelyTypo(unitName, units);
      if (typo) messages.push(`Unknown unit “${unitName}”. Did you mean ${typo}? Correct it, or add the unit first.`);
      else {
        const pending = newUnits.get(lower(unitName)) ?? { name: unitName, roll: false, area: false, rows: [] };
        pending.roll ||= Boolean(row.roll_width_cm?.trim() || row.roll_length_cm?.trim());
        pending.area ||= Boolean(row.coverage_m2?.trim());
        pending.rows.push(result);
        newUnits.set(lower(unitName), pending);
      }
    }

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

  // A new unit is a roll unit or an area unit, not both: the till's calculators need to know which.
  const takenAbbreviations = new Set(units.flatMap((u) => [lower(u.name), lower(u.abbreviation)]));
  const unitsToCreate: NewUnit[] = [];
  for (const pending of newUnits.values()) {
    if (pending.roll && pending.area) {
      for (const r of pending.rows)
        r.messages.push(`New unit “${pending.name}” has rows with roll sizes and rows with m² per unit. Use one kind.`);
      continue;
    }
    const abbreviation = abbreviate(pending.name, takenAbbreviations);
    takenAbbreviations.add(abbreviation);
    unitsToCreate.push({
      name: pending.name,
      abbreviation,
      coverage: pending.roll ? "roll" : pending.area ? "area" : "none",
    });
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

    // Named options: the same names on every row, a value for each, and no two rows alike.
    const names1 = new Set(group.rows.map((r) => r.row.option1_name?.trim()).filter(Boolean));
    const names2 = new Set(group.rows.map((r) => r.row.option2_name?.trim()).filter(Boolean));
    const option1Name = [...names1][0];
    const option2Name = [...names2][0];
    if (names1.size > 1 || names2.size > 1)
      first.result.messages.push("option1_name / option2_name differ between rows of this product.");
    if (option2Name && !option1Name) first.result.messages.push("option2_name given without option1_name.");
    const combos = new Map<string, number>();
    for (const { row, result } of group.rows) {
      const v1 = row.option1?.trim();
      const v2 = row.option2?.trim();
      if (option1Name && !v1) result.messages.push(`Missing option1 (${option1Name}).`);
      if (option2Name && !v2) result.messages.push(`Missing option2 (${option2Name}).`);
      if (v1 && !option1Name) result.messages.push("option1 given without option1_name.");
      if (v2 && !option2Name) result.messages.push("option2 given without option2_name.");
      if (v1) {
        const combo = `${v1}|${v2 ?? ""}`.toLowerCase();
        if (combos.has(combo)) result.messages.push(`Same options as row ${combos.get(combo)}.`);
        combos.set(combo, row._row);
      }
    }

    const description = group.rows.map((r) => r.row.description?.trim()).find(Boolean);
    const online = group.rows.map((r) => yesNo(r.row.show_online)).filter((v) => typeof v === "boolean");
    if (new Set(online).size > 1)
      first.result.messages.push("show_online is yes on some rows of this product and no on others.");
    payload.push({
      ...(group.existingId ? { id: group.existingId } : {}),
      name: first.row.product_name?.trim(),
      category_name: first.row.category?.trim(),
      ...(unitByKey.has(unit) ? { unit_id: unitByKey.get(unit) } : { unit_name: first.row.unit?.trim() }),
      ...(description ? { description } : {}),
      ...(online.length > 0 ? { show_online: online[0] } : {}),
      ...(option1Name ? { option1_name: option1Name, option2_name: option2Name ?? null } : {}),
      skus: group.rows.map(({ row }) => {
        const p = parsedRows.get(row)!;
        // Blank optional cells leave existing values alone, so re-importing a partial sheet is safe.
        return {
          code: row.sku_code?.trim(),
          price_kobo: p.price,
          ...(row.variant?.trim() ? { variant_label: row.variant.trim() } : {}),
          ...(option1Name ? { option1: row.option1?.trim(), option2: option2Name ? row.option2?.trim() : null } : {}),
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
      newUnits: unitsToCreate,
      errors: results.filter((r) => r.status === "error").length,
    },
    payload,
  };
}
