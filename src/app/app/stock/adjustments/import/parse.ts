import type { Grid } from "@/lib/spreadsheet";
import type { OpeningRow } from "./actions";

// Opening stock comes in one of two layouts:
// - a list: one row per item per location, with location, sku_code, (batch) and quantity columns;
// - a count sheet, like the product workbook: one row per item, with an item code column and a
//   "Count – <location>" column per location.

const COLUMNS: Record<string, keyof Omit<OpeningRow, "_row">> = {
  location: "location",
  locationcode: "location",
  store: "location",
  skucode: "sku_code",
  sku: "sku_code",
  code: "sku_code",
  itemid: "sku_code",
  itemcode: "sku_code",
  barcode: "sku_code",
  batch: "batch",
  batchno: "batch",
  lot: "batch",
  quantity: "quantity",
  qty: "quantity",
  count: "quantity",
  counted: "quantity",
};
const key = (h: unknown) =>
  COLUMNS[
    String(h ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
  ];
/** "Count – Plaza", "Count-Plaza", "Count: Plaza" → "Plaza". */
const countColumn = (h: unknown) => /^\s*count\s*[-–—:]?\s*(\S.*?)\s*$/i.exec(String(h ?? ""))?.[1] ?? null;

type Layout =
  | { kind: "list"; header: number }
  | { kind: "counts"; header: number; code: number; locations: { name: string; col: number }[] };

function findLayout(grid: Grid): Layout | null {
  for (let header = 0; header < Math.min(10, grid.length); header++) {
    const row = grid[header] ?? [];
    const keys = row.map(key);
    if (keys.includes("location") && keys.includes("sku_code") && keys.includes("quantity"))
      return { kind: "list", header };
    const code = keys.indexOf("sku_code");
    const locations = row.flatMap((h, col) => {
      const name = countColumn(h);
      return name ? [{ name, col }] : [];
    });
    if (code >= 0 && locations.length > 0) return { kind: "counts", header, code, locations };
  }
  return null;
}

/** Whether a sheet looks like opening stock (used to pick the right tab of a workbook). */
export const isOpeningSheet = (grid: Grid) => findLayout(grid) !== null;

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export function parseOpeningStock(grid: Grid): { rows: OpeningRow[]; layout: string } {
  const layout = findLayout(grid);
  if (!layout)
    throw new Error(
      "Couldn't find the heading row: either location, sku_code and quantity columns, or an item code column with a “Count – <location>” column per location.",
    );
  const rows: OpeningRow[] = [];

  if (layout.kind === "list") {
    const mapping = grid[layout.header].map(key);
    grid.slice(layout.header + 1).forEach((cells, i) => {
      const row: OpeningRow = { _row: layout.header + i + 2 };
      let any = false;
      mapping.forEach((k, c) => {
        const v = text(cells[c]);
        if (k && v && !row[k]) {
          row[k] = v;
          any = true;
        }
      });
      if (any) rows.push(row);
    });
    return { rows, layout: "one row per item per location" };
  }

  // Count sheet: a blank count means nothing at that location; a 0 is a count of zero and is kept.
  grid.slice(layout.header + 1).forEach((cells, i) => {
    const sku_code = text(cells[layout.code]);
    for (const { name, col } of layout.locations) {
      const quantity = text(cells[col]);
      if (!quantity) continue;
      rows.push({ _row: layout.header + i + 2, location: name, sku_code, quantity });
    }
  });
  return { rows, layout: `count columns for ${layout.locations.map((l) => l.name).join(", ")}` };
}
