"use client";

import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import { saveDiscountLimit } from "./actions";

export function LimitForm({ id, pct }: { id: string; pct: number }) {
  return (
    <ActionForm action={saveDiscountLimit} className="flex flex-wrap items-center justify-end gap-2">
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <label className="flex items-center gap-1">
            <span className="sr-only">Discount limit (%)</span>
            <input
              name="pct"
              type="number"
              min={0}
              max={100}
              step="0.5"
              defaultValue={pct}
              className="input w-20 text-right tabular-nums"
            />
            <span className="text-muted">%</span>
          </label>
          <SubmitButton className="btn btn-secondary">Save</SubmitButton>
          <div className="w-full text-right">
            <FormMessage state={state} />
          </div>
        </>
      )}
    </ActionForm>
  );
}
