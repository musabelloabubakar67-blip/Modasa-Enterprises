import Papa from "papaparse";
import { getStaff } from "@/lib/auth";
import { IMPORT_COLUMNS } from "../columns";

const EXAMPLES = [
  [
    "Centre Rug – Turkey",
    "Rugs",
    "Piece",
    "CRUG-001",
    "3 × 5",
    "40000",
    "",
    "26000",
    "",
    "Turkish centre rug",
    "",
    "",
    "",
    "yes",
  ],
  ["Centre Rug – Turkey", "Rugs", "Piece", "CRUG-002", "4 × 6", "70000", "65000", "45000", "", "", "", "", "", "yes"],
  [
    "Wallpaper ALLWP-001",
    "Wallpaper",
    "Roll",
    "ALLWP-001A",
    "Design A",
    "4500",
    "",
    "",
    "",
    "",
    "53",
    "1000",
    "",
    "yes",
  ],
  ["Vinyl Floor Tiles", "Flooring", "Box", "VL-68001", "Brown", "18000", "", "", "", "", "", "", "3.34", ""],
  // Variants that differ in two ways: name the options, give each row its values (the variant column is left blank).
  ...[
    ["SHAG-57G", "5 × 7 ft", "Grey", "95000"],
    ["SHAG-57C", "5 × 7 ft", "Cream", "95000"],
    ["SHAG-710G", "7 × 10 ft", "Grey", "160000"],
  ].map(([code, size, colour, price]) => [
    "Shaggy Rug",
    "Rugs",
    "Piece",
    code,
    "",
    price,
    ...Array(8).fill(""),
    "Size",
    size,
    "Colour",
    colour,
  ]),
];

export async function GET() {
  if (!(await getStaff())) return new Response("Unauthorized", { status: 401 });

  const csv = Papa.unparse({ fields: IMPORT_COLUMNS.map((c) => c.label), data: EXAMPLES });
  // BOM so Excel opens it as UTF-8 (keeps characters like "×" and "₦" intact).
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="product-import-template.csv"',
    },
  });
}
