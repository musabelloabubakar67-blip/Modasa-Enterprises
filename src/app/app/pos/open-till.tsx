"use client";

import { useState, useTransition } from "react";
import { openTill } from "./actions";

export function OpenTill({ shopId, currency }: { shopId: string; currency: string }) {
  const [float, setFloat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await openTill(shopId, float);
          if (result.error) setError(result.error);
        });
      }}
    >
      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="float" className="label">
          Cash in the drawer now ({currency})
        </label>
        <input
          id="float"
          className="input text-lg tabular-nums"
          inputMode="decimal"
          value={float}
          onChange={(e) => setFloat(e.target.value)}
          placeholder="e.g. 10000"
          autoFocus
          required
        />
        <p className="text-muted mt-1 text-xs">Enter 0 if the drawer is empty.</p>
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Opening…" : "Open till"}
      </button>
    </form>
  );
}
