import ExcelJS from "exceljs";
import { MAX_IMPORT_ROWS } from "../columns";

/**
 * The product workbook: one Excel file for both uploads. Products → Import reads its Products tab, and
 * Stock → Adjustments → Import opening stock reads the Count columns on the same tab. Built per download so
 * the dropdowns hold the current categories and units and there is a Count column for each location.
 *
 * Headings are the friendly ones from Modasa's own workbook; columns.ts and the opening-stock parser accept
 * them. Example rows are on their own Examples tab, so a forgotten example can't be imported by accident.
 */

const LAST_ROW = MAX_IMPORT_ROWS + 1;

type Column = { heading: string; width: number; note: string; fill?: "required" | "count" };

const productColumns = (cur: string): Column[] => [
  { heading: "Category", width: 22, note: "Pick from the list, or type a new one (it is created).", fill: "required" },
  { heading: "Product name", width: 28, note: "Rows with the same name become one product.", fill: "required" },
  { heading: "Variant (size / design / colour)", width: 26, note: "What customers see, e.g. 4 × 6 ft." },
  { heading: "Option 1 name", width: 14, note: "Varies two ways? e.g. Size" },
  { heading: "Option 1", width: 12, note: "e.g. 5 × 7 ft" },
  { heading: "Option 2 name", width: 14, note: "e.g. Colour" },
  { heading: "Option 2", width: 12, note: "e.g. Grey" },
  { heading: "Item code", width: 16, note: "Unique, no spaces.", fill: "required" },
  { heading: "Unit", width: 12, note: "From the list.", fill: "required" },
  { heading: `Selling price (${cur})`, width: 14, note: "Price at the till.", fill: "required" },
  { heading: `Sale price (${cur})`, width: 13, note: "Only for a standing discount." },
  { heading: `Cost price (${cur})`, width: 13, note: "Hidden from cashiers." },
  { heading: "Barcode", width: 14, note: "Blank = use the item code." },
  { heading: "m² per unit (sheets, panels, tiles)", width: 16, note: "Area one unit covers." },
  { heading: "Roll width (cm)", width: 11, note: "Wallpaper." },
  { heading: "Roll length (cm)", width: 11, note: "Wallpaper." },
  { heading: "Description", width: 30, note: "Shown on the website." },
  { heading: "Show on website", width: 11, note: "yes / no. Blank = unchanged." },
];

const EXAMPLES = [
  ["Flooring & Mats", "Centre Rug", "3 × 5 ft", "", "", "", "", "CRUG-35", "Piece", 40000, "", 26000],
  ["Flooring & Mats", "Centre Rug", "4 × 6 ft", "", "", "", "", "CRUG-46", "Piece", 70000, 65000, 45000],
  ["Flooring & Mats", "Shaggy Rug", "", "Size", "5 × 7 ft", "Colour", "Grey", "SHAG-57G", "Piece", 95000, "", 60000],
  ["Flooring & Mats", "Shaggy Rug", "", "Size", "5 × 7 ft", "Colour", "Cream", "SHAG-57C", "Piece", 95000, "", 60000],
  [
    "Wall Finishes",
    "Wallpaper ALLWP",
    "Design A",
    "",
    "",
    "",
    "",
    "ALLWP-001A",
    "Roll",
    4500,
    "",
    "",
    "",
    "",
    53,
    1000,
  ],
  ["Wall Finishes", "Marble Sheet", "White Stone", "", "", "", "", "MRB-WS", "Sheet", 18000, "", "", "", 3.34],
];

export type WorkbookInput = {
  businessName: string;
  currency: string;
  categories: string[];
  units: string[];
  locations: { name: string; kind: string }[];
};

export async function buildProductWorkbook({ businessName, currency, categories, units, locations }: WorkbookInput) {
  const cur = currency === "NGN" ? "₦" : currency;
  const columns = [
    ...productColumns(cur),
    ...locations.map((l) => ({
      heading: `Count – ${l.name}`,
      width: 12,
      note: l.kind === "warehouse" ? "Warehouse count." : "Shop count.",
      fill: "count" as const,
    })),
  ];
  const col = (heading: string) => columns.findIndex((c) => c.heading === heading) + 1;
  const letter = (n: number) => {
    let s = "";
    for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const range = (heading: string) => `${letter(col(heading))}2:${letter(col(heading))}${LAST_ROW}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = businessName;
  // Products is the first tab, so both importers always pick it; the file opens on Read me.
  const sheet = wb.addWorksheet("Products", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const readme = wb.addWorksheet("Read me", { properties: { tabColor: { argb: "FF1F3A5F" } } });
  const examples = wb.addWorksheet("Examples", { views: [{ state: "frozen", ySplit: 1 }] });
  const lists = wb.addWorksheet("Lists");

  // ---------- Read me ----------
  readme.getColumn(1).width = 4;
  readme.getColumn(2).width = 110;
  const lines: [string, "title" | "head" | "text"][] = [
    [`${businessName} – product workbook`, "title"],
    [
      "Fill in the Products tab, then upload this same file twice. Nothing is saved until you press the button at the end of each preview.",
      "text",
    ],
    ["", "text"],
    ["How to upload", "head"],
    [
      "1. Products → Import → choose this file. It finds the Products tab by itself. Fix any rows it flags, save, choose the file again.",
      "text",
    ],
    ["   The Import button only appears when there are 0 rows with errors.", "text"],
    ["2. Stock → Adjustments → Import opening stock → choose the SAME file. It reads the Count columns.", "text"],
    [
      "   Counts SET the stock (uploading 10 where the system shows 7 gives 10, not 17) and apply straight away.",
      "text",
    ],
    [
      "Uploading a corrected file again is safe: an Item code that already exists is updated, not duplicated. Blank cells change nothing.",
      "text",
    ],
    ["", "text"],
    ["Rules", "head"],
    [
      "1. One row per thing a cashier sells at its own price: each rug size, each figurine design is its own row.",
      "text",
    ],
    [
      '2. Rows with the same Product name become one product. Spell it the same on every row ("Bedsheet" ≠ "Bed sheet").',
      "text",
    ],
    [
      "3. Variant is what customers see on the website, in words (4 × 6 ft, Gold Eiffel Tower), never the item code.",
      "text",
    ],
    [
      "4. Varies in two ways (Size and Colour)? Leave Variant blank; fill Option 1 name / Option 1 / Option 2 name / Option 2.",
      "text",
    ],
    [
      "   Same option names on every row of the product. Put colour or design second: those show the variant's photo on the website.",
      "text",
    ],
    [
      "5. Item code: unique, no spaces (use a dash). Selling price on every row. Sale price only for a standing discount.",
      "text",
    ],
    [
      "6. Cost price = what one item costs you. Cashiers never see it. Without it the item is left out of the profit report.",
      "text",
    ],
    [
      "7. Count columns: how many at each location. Blank = none there; 0 = counted, none there. Whole numbers for pieces.",
      "text",
    ],
    [
      "   The heading must be 'Count – ' + the location's name exactly as in the system. These were made for your current locations.",
      "text",
    ],
    [
      "8. Unit must be one from the list. A new unit (Bag, Panel…) must be added first: Products → Categories & units.",
      "text",
    ],
    [
      "9. Don't rename or remove columns: the system reads them by their headings. Extra columns of your own are ignored.",
      "text",
    ],
    ["", "text"],
    ["The Examples tab shows filled-in rows to copy the pattern from. It is never imported.", "head"],
  ];
  for (const [text, style] of lines) {
    const row = readme.addRow(["", text]);
    if (style === "title") row.font = { bold: true, size: 15 };
    if (style === "head") row.font = { bold: true, size: 12 };
  }
  // ---------- Examples: same headings as Products, never imported ----------
  const exampleColumns = productColumns(cur);
  examples.columns = exampleColumns.map((c) => ({ header: c.heading, width: c.width }));
  examples.getRow(1).font = { bold: true };
  examples.getRow(1).alignment = { wrapText: true, vertical: "middle" };
  examples.getRow(1).height = 42;
  EXAMPLES.forEach((values) => examples.addRow(values.map((v) => (v === "" ? null : v))));
  examples.addRow([]);
  for (const note of [
    "These rows are only examples: the upload never reads this tab. Fill in the Products tab.",
    "Centre Rug: one row per size, Variant filled in.",
    "Shaggy Rug varies two ways (size and colour): Variant blank, the four Option columns filled.",
    "Wallpaper: roll width and length, so the till can work out rolls for a wall.",
    "Marble Sheet: m² per unit, so the till can work out how many sheets cover a wall.",
  ])
    examples.addRow([note]).font = { italic: true, color: { argb: "FF555555" } };

  // ---------- Lists (for the dropdowns) ----------
  lists.columns = [
    { header: "Categories", width: 26 },
    { header: "Units", width: 16 },
    { header: "Show on website", width: 16 },
  ];
  lists.getRow(1).font = { bold: true };
  categories.forEach((c, i) => (lists.getCell(i + 2, 1).value = c));
  units.forEach((u, i) => (lists.getCell(i + 2, 2).value = u));
  ["yes", "no"].forEach((v, i) => (lists.getCell(i + 2, 3).value = v));

  // ---------- Products ----------
  sheet.columns = columns.map((c) => ({ header: c.heading, width: c.width }));
  const header = sheet.getRow(1);
  header.height = 42;
  header.font = { bold: true };
  header.alignment = { wrapText: true, vertical: "middle" };
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    const colour = c.fill === "required" ? "FFFFF2CC" : c.fill === "count" ? "FFDDEBF7" : "FFF2F2F2";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colour } };
    cell.note = c.note;
  });

  const listRef = (column: string, count: number) => `Lists!$${column}$2:$${column}$${Math.max(count, 1) + 1}`;
  // ExcelJS supports dropdowns but its type definitions leave them out.
  const validations = (
    sheet as unknown as { dataValidations: { add: (range: string, rule: ExcelJS.DataValidation) => void } }
  ).dataValidations;
  validations.add(range("Category"), {
    type: "list",
    allowBlank: true,
    formulae: [listRef("A", categories.length)],
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: "New category?",
    error: "That isn't one of the categories in the system. It will be created as a new category: check the spelling.",
  });
  validations.add(range("Unit"), {
    type: "list",
    allowBlank: true,
    formulae: [listRef("B", units.length)],
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Unknown unit",
    error: "Pick a unit from the list. A new unit must be added first under Products → Categories & units.",
  });
  validations.add(range("Show on website"), {
    type: "list",
    allowBlank: true,
    formulae: ["Lists!$C$2:$C$3"],
    showErrorMessage: true,
    errorStyle: "stop",
    error: "yes, no, or leave blank.",
  });
  const numeric = [
    `Selling price (${cur})`,
    `Sale price (${cur})`,
    `Cost price (${cur})`,
    "m² per unit (sheets, panels, tiles)",
    "Roll width (cm)",
    "Roll length (cm)",
    ...locations.map((l) => `Count – ${l.name}`),
  ];
  for (const heading of numeric) {
    validations.add(range(heading), {
      type: "decimal",
      operator: "greaterThanOrEqual",
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorStyle: "stop",
      error: "Enter a number, 0 or more (no ₦ sign or commas needed).",
    });
  }

  wb.views = [{ activeTab: 1, x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, visibility: "visible" }];

  return wb.xlsx.writeBuffer();
}
