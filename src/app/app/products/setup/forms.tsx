"use client";

import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import type { Unit } from "@/lib/products";
import { saveCategory, saveUnit } from "../actions";

export function CategoryForm({
  category,
}: {
  category?: { id: string; name: string; sort_order: number; is_active: boolean };
}) {
  return (
    <ActionForm action={saveCategory} resetOnSuccess={!category} className="space-y-3">
      {(state) => (
        <>
          <FormMessage state={state} />
          {category && <input type="hidden" name="id" value={category.id} />}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-40 flex-1">
              <span className="label">{category ? "Name" : "New category"}</span>
              <input name="name" className="input" defaultValue={category?.name} required />
            </label>
            <label className="w-24">
              <span className="label">Order</span>
              <input
                name="sort_order"
                type="number"
                min={0}
                className="input"
                defaultValue={category?.sort_order ?? 0}
              />
            </label>
            {category && (
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={category.is_active} />
                Active
              </label>
            )}
            <SubmitButton>{category ? "Save" : "Add"}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function UnitForm({ unit }: { unit?: Unit }) {
  return (
    <ActionForm action={saveUnit} resetOnSuccess={!unit} className="space-y-3">
      {(state) => (
        <>
          <FormMessage state={state} />
          {unit && <input type="hidden" name="id" value={unit.id} />}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-36 flex-1">
              <span className="label">{unit ? "Name" : "New unit"}</span>
              <input name="name" className="input" defaultValue={unit?.name} placeholder="e.g. Pack" required />
            </label>
            <label className="w-24">
              <span className="label">Short</span>
              <input name="abbreviation" className="input" defaultValue={unit?.abbreviation} maxLength={10} required />
            </label>
            <label className="w-40">
              <span className="label">Coverage</span>
              <select name="coverage" className="input" defaultValue={unit?.coverage ?? "none"}>
                <option value="none">None</option>
                <option value="roll">Roll size</option>
                <option value="area">m² per unit</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="allows_decimal" defaultChecked={unit?.allows_decimal} />
              Allow decimals (e.g. 2.5 m)
            </label>
            <SubmitButton>{unit ? "Save" : "Add"}</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
