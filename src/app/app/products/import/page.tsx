import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { IMPORT_COLUMNS } from "./columns";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage() {
  await requireStaff(["owner", "manager"]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/app/products" className="text-muted text-sm hover:underline">
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Import products</h1>
        <p className="text-muted mt-1 text-sm">
          Upload a CSV or Excel file with one row per SKU. You&apos;ll see a preview before anything is saved. Rows
          whose sku_code already exists update that item; blank optional cells leave existing values unchanged.
        </p>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">1. Get the template</h2>
          <a href="/app/products/import/template" className="btn btn-secondary" download>
            Download template (CSV)
          </a>
        </div>
        <details className="mt-3 text-sm">
          <summary className="text-accent cursor-pointer">Column guide</summary>
          <table className="mt-2 w-full">
            <tbody className="divide-border divide-y">
              {IMPORT_COLUMNS.map((c) => (
                <tr key={c.key}>
                  <td className="py-1.5 pr-4 font-mono whitespace-nowrap">
                    {c.label}
                    {c.required && <span className="text-danger">*</span>}
                  </td>
                  <td className="text-muted py-1.5">{c.help}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <ImportWizard />
    </div>
  );
}
