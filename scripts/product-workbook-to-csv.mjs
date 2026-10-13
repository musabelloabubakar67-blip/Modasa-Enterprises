// Turns a completed product workbook (the "Products" tab handed to the business to fill in) into the two
// files the app imports: products.csv for /app/products/import and opening-stock.csv for
// /app/stock/adjustments/import. The app's own import preview does the validation; this only reshapes.
//
//   node scripts/product-workbook-to-csv.mjs <workbook.xlsx> <out-dir> [--location "Shop 1"]
//
// --location keeps only that location's counts (e.g. loading one location for training).
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";

const args = process.argv.slice(2);
const locIndex = args.indexOf("--location");
const onlyLocation = locIndex === -1 ? null : args.splice(locIndex, 2)[1];
const [file, outDir] = args;
if (!file || !outDir || (locIndex !== -1 && !onlyLocation)) {
  console.error('Usage: node scripts/product-workbook-to-csv.mjs <workbook.xlsx> <out-dir> [--location "Shop 1"]');
  process.exit(1);
}

// Workbook heading → product import column.
const PRODUCT_COLUMNS = {
  "Product name": "product_name",
  Category: "category",
  Unit: "unit",
  "Item code": "sku_code",
  "Variant (size / design / colour)": "variant",
  "Selling price (₦)": "price",
  "Sale price (₦)": "sale_price",
  "Cost price (₦)": "cost_price",
  Barcode: "barcode",
  Description: "description",
  "Roll width (cm)": "roll_width_cm",
  "Roll length (cm)": "roll_length_cm",
  "m² per unit (sheets, panels, tiles)": "coverage_m2",
};
const COUNT_PREFIX = "Count – ";

const grid = await readSheet(file, "Products");
const headings = grid[0].map((h) => String(h ?? "").trim());
const col = (name) => headings.indexOf(name);
const text = (v) => (v === null || v === undefined ? "" : String(v).trim().replace(/^₦\s*/, ""));
// Prices and counts may have been typed with thousands separators.
const number = (v) => (typeof v === "number" ? String(v) : text(v).replace(/,/g, ""));
const numeric = new Set(["price", "sale_price", "cost_price", "roll_width_cm", "roll_length_cm", "coverage_m2"]);

const missing = ["Product name", "Item code"].filter((h) => col(h) === -1);
if (missing.length) {
  console.error(`Not a product workbook: no ${missing.join(", ")} column on the Products tab.`);
  process.exit(1);
}
const locations = headings
  .map((h, i) => ({ name: h.slice(COUNT_PREFIX.length).trim(), i }))
  .filter((_, i) => headings[i].startsWith(COUNT_PREFIX));
if (onlyLocation && !locations.some((l) => l.name === onlyLocation)) {
  console.error(`No "${COUNT_PREFIX}${onlyLocation}" column. Found: ${locations.map((l) => l.name).join(", ")}`);
  process.exit(1);
}

const products = [];
const stock = [];
const problems = [];
grid.slice(1).forEach((cells, r) => {
  const name = text(cells[col("Product name")]);
  if (!name) return;
  const rowNumber = r + 2;
  const product = {};
  for (const [heading, key] of Object.entries(PRODUCT_COLUMNS)) {
    const i = col(heading);
    product[key] = i === -1 ? "" : numeric.has(key) ? number(cells[i]) : text(cells[i]);
  }
  if (!product.sku_code) problems.push(`Row ${rowNumber} (${name}): no item code`);
  if (!product.price) problems.push(`Row ${rowNumber} (${name}): no selling price`);
  products.push(product);

  for (const l of locations) {
    if (onlyLocation && l.name !== onlyLocation) continue;
    const quantity = number(cells[l.i]);
    if (quantity && Number(quantity) > 0)
      stock.push({ location: l.name, sku_code: product.sku_code, batch: "", quantity });
  }
});

fs.mkdirSync(outDir, { recursive: true });
// BOM so Excel opens the files as UTF-8 if someone checks them by hand.
const write = (name, rows, fields) =>
  fs.writeFileSync(
    path.join(outDir, name),
    `﻿${Papa.unparse({ fields, data: rows.map((x) => fields.map((f) => x[f])) })}`,
  );
write("products.csv", products, Object.values(PRODUCT_COLUMNS));
write("opening-stock.csv", stock, ["location", "sku_code", "batch", "quantity"]);

console.log(`${products.length} product rows → ${path.join(outDir, "products.csv")}`);
console.log(`${stock.length} stock lines → ${path.join(outDir, "opening-stock.csv")}`);
if (problems.length) {
  console.log(`\n${problems.length} rows will be rejected by the import until fixed:`);
  for (const p of problems.slice(0, 30)) console.log(`  ${p}`);
  if (problems.length > 30) console.log(`  …and ${problems.length - 30} more`);
}
