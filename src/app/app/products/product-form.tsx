"use client";

import { useState } from "react";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import { formatMoney, parseMoney, toMoneyInput } from "@/lib/money";
import type { Category, Unit } from "@/lib/products";
import { saveProduct, type SkuFormRow } from "./actions";

export type ProductFormData = {
  id: string;
  name: string;
  category_id: string;
  unit_id: string;
  description: string | null;
  is_active: boolean;
  skus: {
    id: string;
    code: string;
    variant_label: string | null;
    price_kobo: number;
    promo_price_kobo: number | null;
    cost_kobo: number | null;
    barcode: string | null;
    roll_width_cm: number | null;
    roll_length_cm: number | null;
    coverage_m2: number | null;
    is_active: boolean;
  }[];
};

const emptySku = (): SkuFormRow => ({
  code: "",
  variant_label: "",
  price: "",
  promo_price: "",
  cost: "",
  barcode: "",
  roll_width_cm: "",
  roll_length_cm: "",
  coverage_m2: "",
  is_active: true,
});

const str = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function ProductForm({
  product,
  categories,
  units,
  currency,
}: {
  product?: ProductFormData;
  categories: Category[];
  units: Unit[];
  currency: string;
}) {
  const [unitId, setUnitId] = useState(product?.unit_id ?? units[0]?.id ?? "");
  const [skus, setSkus] = useState<SkuFormRow[]>(
    product?.skus.map((s) => ({
      id: s.id,
      code: s.code,
      variant_label: s.variant_label ?? "",
      price: toMoneyInput(s.price_kobo),
      promo_price: toMoneyInput(s.promo_price_kobo),
      cost: toMoneyInput(s.cost_kobo),
      barcode: s.barcode ?? "",
      roll_width_cm: str(s.roll_width_cm),
      roll_length_cm: str(s.roll_length_cm),
      coverage_m2: str(s.coverage_m2),
      is_active: s.is_active,
    })) ?? [emptySku()],
  );

  const unit = units.find((u) => u.id === unitId);
  const update = (i: number, patch: Partial<SkuFormRow>) =>
    setSkus((rows) => rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <ActionForm action={saveProduct} className="space-y-6">
      {(state) => {
        const errors = state.fieldErrors ?? {};
        const skuErrors = state.skuErrors ?? {};
        return (
          <>
            <FormMessage state={state} />
            {product && <input type="hidden" name="id" value={product.id} />}
            <input type="hidden" name="skus" value={JSON.stringify(skus)} />

            <section className="card space-y-4 p-6">
              <h2 className="font-semibold">Product</h2>
              <Field label="Name" name="name" error={errors.name}>
                <input
                  id="name"
                  name="name"
                  className="input"
                  defaultValue={product?.name}
                  placeholder="e.g. Centre Rug – Turkey"
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" name="category_id" error={errors.category_id}>
                  <select
                    id="category_id"
                    name="category_id"
                    className="input"
                    defaultValue={product?.category_id ?? ""}
                    required
                  >
                    <option value="" disabled>
                      Choose a category…
                    </option>
                    {categories
                      .filter((c) => c.is_active || c.id === product?.category_id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field
                  label="Sold by"
                  name="unit_id"
                  error={errors.unit_id}
                  hint="Prices below are per this unit. Stock is counted in it too."
                >
                  <select
                    id="unit_id"
                    name="unit_id"
                    className="input"
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    required
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.abbreviation})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Description" name="description" error={errors.description} hint="Optional.">
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  className="input"
                  defaultValue={product?.description ?? ""}
                />
              </Field>
              {product && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_active" defaultChecked={product.is_active} />
                  Active (untick to archive — it disappears from sale but its history is kept)
                </label>
              )}
              {!product && <input type="hidden" name="is_active" value="on" />}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="font-semibold">SKUs</h2>
                <p className="text-muted text-sm">
                  One row per item you stock and sell separately — e.g. each rug size or wallpaper design. A product
                  with no variants just has one row.
                </p>
                {errors.skus && <p className="text-danger mt-1 text-sm">{errors.skus}</p>}
              </div>

              {skus.map((sku, i) => {
                const e = skuErrors[i] ?? {};
                const id = (f: string) => `sku-${i}-${f}`;
                const price = parseMoney(sku.price);
                const promo = parseMoney(sku.promo_price);
                const cost = parseMoney(sku.cost);
                const sell = promo ?? price;
                const margin =
                  sell && cost !== null && !Number.isNaN(sell) && !Number.isNaN(cost) && sell > 0
                    ? Math.round(((sell - cost) / sell) * 100)
                    : null;
                return (
                  <div key={i} className={`card space-y-3 p-4 ${sku.is_active ? "" : "opacity-60"}`}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="SKU code" name={id("code")} error={e.code}>
                        <input
                          id={id("code")}
                          className="input font-mono"
                          value={sku.code}
                          onChange={(ev) => update(i, { code: ev.target.value })}
                          placeholder="e.g. CRUG-002"
                          required
                        />
                      </Field>
                      <Field
                        label="Variant"
                        name={id("variant")}
                        error={e.variant_label}
                        hint="Size, colour… optional."
                      >
                        <input
                          id={id("variant")}
                          className="input"
                          value={sku.variant_label}
                          onChange={(ev) => update(i, { variant_label: ev.target.value })}
                          placeholder="e.g. 4 × 6"
                        />
                      </Field>
                      <Field
                        label="Barcode"
                        name={id("barcode")}
                        error={e.barcode}
                        hint="Leave blank to use the SKU code."
                      >
                        <input
                          id={id("barcode")}
                          className="input font-mono"
                          value={sku.barcode}
                          onChange={(ev) => update(i, { barcode: ev.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label={`Price (${currency})`} name={id("price")} error={e.price}>
                        <input
                          id={id("price")}
                          className="input tabular-nums"
                          inputMode="decimal"
                          value={sku.price}
                          onChange={(ev) => update(i, { price: ev.target.value })}
                          required
                        />
                      </Field>
                      <Field
                        label="Sale price"
                        name={id("promo")}
                        error={e.promo_price}
                        hint="Optional. Customers pay this instead."
                      >
                        <input
                          id={id("promo")}
                          className="input tabular-nums"
                          inputMode="decimal"
                          value={sku.promo_price}
                          onChange={(ev) => update(i, { promo_price: ev.target.value })}
                        />
                      </Field>
                      <Field
                        label="Cost price"
                        name={id("cost")}
                        error={e.cost}
                        hint={
                          margin !== null
                            ? `Margin ${margin}% (${formatMoney(sell! - cost!, currency)})`
                            : "Optional. Hidden from cashiers."
                        }
                      >
                        <input
                          id={id("cost")}
                          className="input tabular-nums"
                          inputMode="decimal"
                          value={sku.cost}
                          onChange={(ev) => update(i, { cost: ev.target.value })}
                        />
                      </Field>
                    </div>

                    {unit?.coverage === "roll" && (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Roll width (cm)" name={id("rw")} error={e.roll_width_cm}>
                          <input
                            id={id("rw")}
                            className="input"
                            inputMode="decimal"
                            value={sku.roll_width_cm}
                            onChange={(ev) => update(i, { roll_width_cm: ev.target.value })}
                            placeholder="53"
                          />
                        </Field>
                        <Field
                          label="Roll length (cm)"
                          name={id("rl")}
                          error={e.roll_length_cm}
                          hint="Used by the roll calculator."
                        >
                          <input
                            id={id("rl")}
                            className="input"
                            inputMode="decimal"
                            value={sku.roll_length_cm}
                            onChange={(ev) => update(i, { roll_length_cm: ev.target.value })}
                            placeholder="1000"
                          />
                        </Field>
                      </div>
                    )}
                    {unit?.coverage === "area" && (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field
                          label={`Coverage (m² per ${unit.abbreviation})`}
                          name={id("m2")}
                          error={e.coverage_m2}
                          hint="Used to work out how many to sell for a floor area."
                        >
                          <input
                            id={id("m2")}
                            className="input"
                            inputMode="decimal"
                            value={sku.coverage_m2}
                            onChange={(ev) => update(i, { coverage_m2: ev.target.value })}
                          />
                        </Field>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 text-sm">
                      {sku.id ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={sku.is_active}
                            onChange={(ev) => update(i, { is_active: ev.target.checked })}
                          />
                          Active
                        </label>
                      ) : (
                        <span className="text-muted">New</span>
                      )}
                      {!sku.id && skus.length > 1 && (
                        <button
                          type="button"
                          className="text-danger hover:underline"
                          onClick={() => setSkus((rows) => rows.filter((_, j) => j !== i))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSkus((rows) => [...rows, emptySku()])}
              >
                + Add another SKU
              </button>
            </section>

            <div className="flex gap-2">
              <SubmitButton>{product ? "Save product" : "Create product"}</SubmitButton>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
