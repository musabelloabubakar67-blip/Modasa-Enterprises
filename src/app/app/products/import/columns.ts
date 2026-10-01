// Import columns, shared by the browser (reading the file) and the server (validating it).

export const IMPORT_COLUMNS = [
  { key: "product_name", label: "product_name", required: true, help: "Rows with the same name become one product." },
  { key: "category", label: "category", required: true, help: "New categories are created automatically." },
  { key: "unit", label: "unit", required: true, help: "Piece, Set, Roll, Box… (name or short form)." },
  { key: "sku_code", label: "sku_code", required: true, help: "Unique code per item, e.g. CRUG-002." },
  { key: "variant", label: "variant", required: false, help: "Size, colour… e.g. 4 × 6." },
  { key: "price", label: "price", required: true, help: "Selling price, e.g. 70000." },
  { key: "sale_price", label: "sale_price", required: false, help: "Optional standing sale price." },
  { key: "cost_price", label: "cost_price", required: false, help: "Optional. Hidden from cashiers." },
  { key: "barcode", label: "barcode", required: false, help: "Leave blank to use the SKU code." },
  { key: "description", label: "description", required: false, help: "Optional product description." },
  { key: "roll_width_cm", label: "roll_width_cm", required: false, help: "Wallpaper: roll width in cm." },
  { key: "roll_length_cm", label: "roll_length_cm", required: false, help: "Wallpaper: roll length in cm." },
  { key: "coverage_m2", label: "coverage_m2", required: false, help: "Tiles: m² covered by one box." },
  {
    key: "show_online",
    label: "show_online",
    required: false,
    help: "yes or no: show on the website. Blank leaves it as it is.",
  },
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number]["key"];
export type ImportRow = Partial<Record<ImportColumn, string>> & { _row: number };

// Other headings people commonly use, including those in Modasa's existing stock sheets.
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
  item: "sku_code",
  productitemno: "sku_code",
  variant: "variant",
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
  showonline: "show_online",
  online: "show_online",
  website: "show_online",
  onwebsite: "show_online",
  showonwebsite: "show_online",
};

export function matchColumn(heading: unknown): ImportColumn | null {
  const normalised = String(heading ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ALIASES[normalised] ?? null;
}

export const MAX_IMPORT_ROWS = 3000;
