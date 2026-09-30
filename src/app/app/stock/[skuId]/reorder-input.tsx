"use client";

import { useState, useTransition } from "react";
import { setReorderLevel } from "../actions";
import { formatQty } from "@/lib/quantity";

/** Inline reorder-level editor: saves when the field loses focus or Enter is pressed. */
export function ReorderInput({ skuId, locationId, initial }: { skuId: string; locationId: string; initial?: number }) {
  const start = initial === undefined ? "" : formatQty(initial);
  const [value, setValue] = useState(start);
  const [saved, setSaved] = useState(start);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  function save() {
    if (value.trim() === saved) return;
    startTransition(async () => {
      const result = await setReorderLevel(skuId, locationId, value);
      if (result.error) setStatus("error");
      else {
        setSaved(value.trim());
        setStatus("saved");
      }
    });
  }

  return (
    <input
      className={`input w-20 text-right ${status === "error" ? "border-danger" : ""} ${status === "saved" ? "border-success" : ""}`}
      value={value}
      inputMode="decimal"
      placeholder="–"
      disabled={pending}
      aria-label="Reorder level"
      title={status === "error" ? "Enter a number, or leave blank for none" : undefined}
      onChange={(e) => {
        setValue(e.target.value);
        setStatus("idle");
      }}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
    />
  );
}
