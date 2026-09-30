"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { readGrid } from "@/lib/spreadsheet";
import { importOpeningStock, type OpeningResult, type OpeningRow } from "./actions";

const COLUMNS: Record<string, keyof Omit<OpeningRow, "_row">> = {
  location: "location",
  locationcode: "location",
  store: "location",
  skucode: "sku_code",
  sku: "sku_code",
  code: "sku_code",
  itemid: "sku_code",
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

export function OpeningImport() {
  const [rows, setRows] = useState<OpeningRow[]>([]);
  const [result, setResult] = useState<OpeningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    setResult(null);
    setError(null);
    try {
      const grid = await readGrid(file);
      const headerIndex = grid.slice(0, 10).findIndex((r) => r.filter((c) => key(c)).length >= 3);
      if (headerIndex === -1) throw new Error("Couldn't find the heading row (location, sku_code, quantity).");
      const mapping = grid[headerIndex].map(key);
      const parsed: OpeningRow[] = [];
      grid.slice(headerIndex + 1).forEach((cells, i) => {
        const row: OpeningRow = { _row: headerIndex + i + 2 };
        let any = false;
        mapping.forEach((k, c) => {
          const v = cells[c] === null || cells[c] === undefined ? "" : String(cells[c]).trim();
          if (k && v && !row[k]) {
            row[k] = v;
            any = true;
          }
        });
        if (any) parsed.push(row);
      });
      setRows(parsed);
      startTransition(async () => setResult(await importOpeningStock(parsed, false)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  if (result?.imported && !result.error) {
    return (
      <div className="card space-y-3 p-6">
        <p role="status" className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          Opening stock recorded for {result.imported.map((i) => `${i.name} (${i.number})`).join(", ")}.
        </p>
        <Link href="/app/stock" className="btn btn-primary">
          View stock
        </Link>
      </div>
    );
  }

  const failed = result?.rows?.filter((r) => r.messages.length) ?? [];

  return (
    <div className="card space-y-4 p-6">
      <label className="btn btn-secondary">
        Choose file (.csv or .xlsx)
        <input
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
      </label>
      {(error || result?.error) && (
        <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error ?? result?.error}
        </p>
      )}
      {pending && <p className="text-muted text-sm">Checking {rows.length} rows…</p>}
      {result?.rows && (
        <>
          <p className="text-sm">
            {rows.length} rows ·{" "}
            {result.byLocation?.map((l) => `${l.name}: ${l.lines} item${l.lines === 1 ? "" : "s"}`).join(" · ") ||
              "no valid rows"}
            {failed.length > 0 && <span className="text-danger"> · {failed.length} with errors</span>}
          </p>
          {failed.length > 0 ? (
            <>
              <table className="w-full text-sm">
                <thead className="text-muted text-left">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Row</th>
                    <th className="py-1 pr-3 font-medium">Location</th>
                    <th className="py-1 pr-3 font-medium">SKU</th>
                    <th className="py-1 font-medium">Problem</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {failed.slice(0, 200).map((r) => (
                    <tr key={r.row}>
                      <td className="py-1 pr-3 tabular-nums">{r.row}</td>
                      <td className="py-1 pr-3">{r.location}</td>
                      <td className="py-1 pr-3 font-mono">{r.code}</td>
                      <td className="text-danger py-1">{r.messages.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm">Fix these rows in your file and choose it again.</p>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                confirm("Record this as opening stock? Stock levels will be set to these counts.") &&
                startTransition(async () => setResult(await importOpeningStock(rows, true)))
              }
            >
              {pending ? "Importing…" : "Record opening stock"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
