"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { readGrid } from "@/lib/spreadsheet";
import { importOpeningStock, type OpeningResult, type OpeningRow } from "./actions";
import { isOpeningSheet, parseOpeningStock } from "./parse";

export function OpeningImport() {
  const [rows, setRows] = useState<OpeningRow[]>([]);
  const [layout, setLayout] = useState("");
  const [result, setResult] = useState<OpeningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    setResult(null);
    setError(null);
    try {
      const { rows: parsed, layout } = parseOpeningStock(await readGrid(file, isOpeningSheet));
      setRows(parsed);
      setLayout(layout);
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
            {rows.length} counts ({layout}) ·{" "}
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
