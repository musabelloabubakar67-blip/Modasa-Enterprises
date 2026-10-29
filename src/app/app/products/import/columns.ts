// Import columns, shared by the browser (reading the file) and the server (validating it). Labels are the
// headings in the product workbook (template/workbook.ts); matchColumn also accepts the older snake_case names.

export const IMPORT_COLUMNS = [
  { key: "product_name", label: "Product name", required: true, help: "Rows with the same name become one product." },
  { key: "category", label: "Category", required: true, help: "New categories are created automatically." },
  { key: "unit", label: "Unit", required: true, help: "Piece, Set, Roll, Box… (name or short form)." },
  { key: "sku_code", label: "Item code", required: true, help: "Unique code per item, no spaces, e.g. CRUG-002." },
  { key: "variant", label: "Variant (size / design / colour)", required: false, help: "Size, colour… e.g. 4 × 6." },
  { key: "price", label: "Selling price", required: true, help: "Selling price, e.g. 70000." },
  { key: "sale_price", label: "Sale price", required: false, help: "Optional standing sale price." },
  { key: "cost_price", label: "Cost price", required: false, help: "Optional. Hidden from cashiers." },
  { key: "barcode", label: "Barcode", required: false, help: "Leave blank to use the SKU code." },
  { key: "description", label: "Description", required: false, help: "Optional product description." },
  { key: "roll_width_cm", label: "Roll width (cm)", required: false, help: "Wallpaper: roll width in cm." },
  { key: "roll_length_cm", label: "Roll length (cm)", required: false, help: "Wallpaper: roll length in cm." },
  {
    key: "coverage_m2",
    label: "m² per unit (sheets, panels, tiles)",
    required: false,
    help: "Tiles, sheets, panels: m² covered by one unit.",
  },
  {
    key: "show_online",
    label: "Show on website",
    required: false,
    help: "yes or no: show on the website. Blank leaves it as it is.",
  },
  {
    key: "option1_name",
    label: "Option 1 name",
    required: false,
    help: "Variants differ in one or two ways? Name the first, e.g. Size. Same on every row of the product.",
  },
  { key: "option1", label: "Option 1", required: false, help: "This row's value for option 1, e.g. 5 × 7 ft." },
  { key: "option2_name", label: "Option 2 name", required: false, help: "Second way they differ, e.g. Colour." },
  { key: "option2", label: "Option 2", required: false, help: "This row's value for option 2, e.g. Grey." },
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number]["key"];
export type ImportRow = Partial<Record<ImportColumn, string>> & { _row: number };

// Other headings people commonly use, including those in Modasa's existing stock sheets and the product
// workbook (docs/training-copy.md). Its "Count – <location>" columns are for the opening-stock import.
const ALIASES: Record<string, ImportColumn> = {
  productname: "product_name",
  product: "product_name",
  name: "product_name",
  itemname: "product_name",
  category: "category",
  unit: "unit",
  soldby: "unit",
  skucode: "sku_code",
  sku: "sku_code",
  code: "sku_code",
  itemid: "sku_code",
  itemno: "sku_code",
  itemcode: "sku_code",
  item: "sku_code",
  productitemno: "sku_code",
  variant: "variant",
  variantsizedesigncolour: "variant",
  size: "variant",
  colour: "variant",
  color: "variant",
  price: "price",
  unitprice: "price",
  amount: "price",
  sellingprice: "price",
  saleprice: "sale_price",
  discountedprice: "sale_price",
  promoprice: "sale_price",
  costprice: "cost_price",
  cost: "cost_price",
  barcode: "barcode",
  description: "description",
  rollwidthcm: "roll_width_cm",
  rolllengthcm: "roll_length_cm",
  coveragem2: "coverage_m2",
  m2perunitsheetspanelstiles: "coverage_m2",
  mperunitsheetspanelstiles: "coverage_m2", // "m² per unit…": the ² drops out when headings are simplified
  showonline: "show_online",
  online: "show_online",
  website: "show_online",
  onwebsite: "show_online",
  showonwebsite: "show_online",
  option1name: "option1_name",
  option1: "option1",
  option2name: "option2_name",
  option2: "option2",
};

export function matchColumn(heading: unknown): ImportColumn | null {
  const normalised = String(heading ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ALIASES[normalised] ?? null;
}

export const MAX_IMPORT_ROWS = 3000;
