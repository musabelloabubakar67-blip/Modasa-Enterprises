"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, parseMoney } from "@/lib/money";
import { closeTill } from "../actions";

type Method = "cash" | "card" | "transfer";

export function CloseTillForm({
  shiftId,
  currency,
  expected,
}: {
  shiftId: string;
  currency: string;
  expected: Record<Method, number>;
}) {
  const router = useRouter();
  const [counted, setCounted] = useState({ cash: "", card: "", transfer: "" });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const diff = (m: Method) => {
    const v = parseMoney(counted[m]);
    return v === null || Number.isNaN(v) ? null : v - expected[m];
  };

  function submit() {
    setError(null);
    const cashDiff = diff("cash");
    if (cashDiff === null) return setError("Count the cash in the drawer and enter the total.");
    const off = (["cash", "card", "transfer"] as Method[]).filter((m) => (diff(m) ?? 0) !== 0);
    if (off.length && !note.trim()) return setError("Something doesn't match. Add a note explaining the difference.");
    if (!confirm("Close the till? No more sales can be made until it's opened again.")) return;
    startTransition(async () => {
      const result = await closeTill(shiftId, counted, note);
      if (result.error) setError(result.error);
      else router.push("/app/sales/shifts?closed=1");
    });
  }

  const labels: Record<Method, [string, string]> = {
    cash: ["Cash counted in the drawer", "Count every note, including the float."],
    card: ["POS terminal total", "From the terminal's end-of-day (settlement) slip. Optional."],
    transfer: ["Transfers received", "From the bank app for this account. Optional."],
  };

  return (
    <section className="card space-y-4 p-4">
      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {(Object.keys(labels) as Method[]).map((m) => {
        const d = diff(m);
        return (
          <label key={m} className="block">
            <span className="label">
              {labels[m][0]} ({currency})
            </span>
            <input
              className="input tabular-nums"
              inputMode="decimal"
              value={counted[m]}
              onChange={(e) => setCounted((c) => ({ ...c, [m]: e.target.value }))}
              autoFocus={m === "cash"}
            />
            <span className="text-muted text-xs">{labels[m][1]}</span>
            {d !== null && (
              <span className={`ml-2 text-sm font-medium ${d === 0 ? "text-success" : "text-danger"}`}>
                {d === 0
                  ? "Matches"
                  : d > 0
                    ? `${formatMoney(d, currency)} over`
                    : `${formatMoney(-d, currency)} short`}
              </span>
            )}
          </label>
        );
      })}
      <label className="block">
        <span className="label">Note</span>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Required if anything doesn't match"
        />
      </label>
      <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
        {pending ? "Closing…" : "Close till"}
      </button>
    </section>
  );
}
