"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { readGrid, type Grid } from "@/lib/spreadsheet";
import { IMPORT_COLUMNS, matchColumn, type ImportColumn, type ImportRow } from "./columns";
import { commitImport, previewImport, type PreviewResult } from "./actions";

/** Finds the heading row (sheets often have a title above it) and turns the rest into rows. */
function gridToRows(grid: Grid): { rows: ImportRow[]; ignored: string[]; missing: string[] } {
  const headerIndex = grid.slice(0, 10).findIndex((r) => r.filter((cell) => matchColumn(cell)).length >= 3);
  if (headerIndex === -1) throw new Error("Couldn't find the heading row. Use the template's column names.");

  const headings = grid[headerIndex];
  const mapping = headings.map((h) => matchColumn(h));
  const ignored = headings.filter((h, i) => String(h ?? "").trim() && !mapping[i]).map(String);
  const found = new Set(mapping.filter(Boolean));
  const missing = IMPORT_COLUMNS.filter((c) => c.required && !found.has(c.key)).map((c) => c.label);

  const rows: ImportRow[] = [];
  grid.slice(headerIndex + 1).forEach((cells, i) => {
    const row: ImportRow = { _row: headerIndex + i + 2 };
    let hasValue = false;
    mapping.forEach((key: ImportColumn | null, col) => {
      if (!key || row[key]) return;
      const value = cells[col];
      const text = value === null || value === undefined ? "" : String(value).trim();
      if (text) {
        row[key] = text;
        hasValue = true;
      }
    });
    if (hasValue) rows.push(row);
  });
  return { rows, ignored, missing };
}

const STATUS_STYLES = {
  new: "bg-success/10 text-success",
  update: "bg-accent/10 text-accent",
  error: "bg-danger/10 text-danger",
} as const;

export function ImportWizard() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setRows([]);
    setPreview(null);
    setError(null);
    setImported(null);
    setIgnored([]);
    setShowAll(false);
  }

  async function onFile(file: File) {
    reset();
    setFileName(file.name);
    try {
      const { rows, ignored, missing } = gridToRows(await readGrid(file));
      if (missing.length)
        throw new Error(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
      setRows(rows);
      setIgnored(ignored);
      startTransition(async () => {
        const result = await previewImport(rows);
        setPreview(result);
        if (result.error) setError(result.error);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  function onImport() {
    startTransition(async () => {
      const result = await commitImport(rows);
      if (result.error) setError(result.error);
      else setImported(result.imported ?? 0);
    });
  }

  const analysis = preview?.analysis;
  const sortedRows = analysis
    ? [...analysis.rows].sort((a, b) => Number(b.status === "error") - Number(a.status === "error") || a.row - b.row)
    : [];
  const visibleRows = showAll ? sortedRows : sortedRows.slice(0, 100);

  if (imported !== null) {
    return (
      <div className="card space-y-3 p-6">
        <p role="status" className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          Imported {imported} product{imported === 1 ? "" : "s"} from {fileName}.
        </p>
        <div className="flex gap-2">
          <Link href="/app/products" className="btn btn-primary">
            View products
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => (reset(), setFileName(""))}>
            Import another file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-semibold">2. Upload your file</h2>
      <label className="btn btn-secondary">
        {fileName ? "Choose a different file" : "Choose file (.csv or .xlsx)"}
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
      {fileName && <p className="text-muted text-sm">{fileName}</p>}

      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {pending && !analysis && <p className="text-muted text-sm">Checking {rows.length} rows…</p>}
      {ignored.length > 0 && <p className="text-muted text-sm">Ignored columns: {ignored.join(", ")}.</p>}

      {analysis && (
        <>
          <h2 className="pt-2 font-semibold">3. Check and import</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-4">
            <li className="bg-background rounded-md p-3">
              <p className="text-lg font-semibold">{analysis.summary.newProducts}</p>new products
            </li>
            <li className="bg-background rounded-md p-3">
              <p className="text-lg font-semibold">{analysis.summary.newSkus}</p>new SKUs
            </li>
            <li className="bg-background rounded-md p-3">
              <p className="text-lg font-semibold">{analysis.summary.updatedSkus}</p>SKUs updated
            </li>
            <li className={`rounded-md p-3 ${analysis.summary.errors ? "bg-danger/10 text-danger" : "bg-background"}`}>
              <p className="text-lg font-semibold">{analysis.summary.errors}</p>rows with errors
            </li>
          </ul>
          {analysis.summary.newCategories.length > 0 && (
            <p className="text-sm">
              New categories will be created: <strong>{analysis.summary.newCategories.join(", ")}</strong>
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted text-left">
                <tr>
                  <th className="py-2 pr-3 font-medium">Row</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {visibleRows.map((r) => (
                  <tr key={r.row} className="align-top">
                    <td className="py-2 pr-3 tabular-nums">{r.row}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLES[r.status]}`}>
                        {r.status === "update" ? "update" : r.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono">{r.code || "—"}</td>
                    <td className="py-2 pr-3">{r.product || "—"}</td>
                    <td className="py-2">{r.messages.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedRows.length > visibleRows.length && (
            <button type="button" className="text-accent text-sm hover:underline" onClick={() => setShowAll(true)}>
              Show all {sortedRows.length} rows
            </button>
          )}

          {analysis.summary.errors > 0 ? (
            <p className="text-sm">Fix the rows marked as errors in your file, then choose it again.</p>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onImport} disabled={pending}>
              {pending ? "Importing…" : `Import ${analysis.rows.length} rows`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
