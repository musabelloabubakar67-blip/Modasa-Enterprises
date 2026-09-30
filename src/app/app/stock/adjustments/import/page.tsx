import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getActiveLocations } from "../../data";
import { OpeningImport } from "./opening-import";

export default async function ImportOpeningStockPage() {
  await requireStaff(["owner", "manager"]);
  const locations = await getActiveLocations();

  return (
    <div className="max-w-4xl space-y-4">
      <Link href="/app/stock/adjustments" className="text-muted text-sm hover:underline">
        ← Adjustments
      </Link>
      <h2 className="text-xl font-semibold">Import opening stock</h2>
      <div className="card space-y-2 p-6 text-sm">
        <p>
          Use this once per location when you go live, after a full count. Upload a CSV or Excel file with these
          columns:
        </p>
        <table className="mt-2">
          <tbody className="divide-border divide-y">
            <tr>
              <td className="py-1 pr-4 font-mono">location*</td>
              <td className="text-muted">Location code or name: {locations.map((l) => l.code).join(", ")}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-mono">sku_code*</td>
              <td className="text-muted">The item&apos;s SKU code or barcode.</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-mono">batch</td>
              <td className="text-muted">For batch-tracked items (wallpaper, tiles). One row per batch.</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 font-mono">quantity*</td>
              <td className="text-muted">The quantity counted.</td>
            </tr>
          </tbody>
        </table>
        <p className="text-muted">
          Each item&apos;s stock is set to the counted quantity. Items not in the file are left unchanged. Everything is
          recorded as &ldquo;Opening stock&rdquo; in the history.
        </p>
      </div>
      <OpeningImport />
    </div>
  );
}
