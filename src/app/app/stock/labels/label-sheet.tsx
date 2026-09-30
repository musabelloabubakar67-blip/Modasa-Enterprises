"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { SkuPicker, skuLabel } from "@/components/sku-picker";
import { formatMoney } from "@/lib/money";
import type { SkuOption } from "../actions";

export type LabelItem = {
  sku: Pick<
    SkuOption,
    "id" | "code" | "barcode" | "variant_label" | "product_name" | "price_kobo" | "promo_price_kobo"
  >;
  batch: string;
  copies: number;
};

// Sizes in millimetres. A4 sheets match common sticker sheets; thermal is one label per page.
const LAYOUTS = {
  a4_21: {
    name: "A4 sheet · 21 per page (63.5 × 38.1 mm)",
    page: [210, 297],
    cols: 3,
    rows: 7,
    label: [63.5, 38.1],
    margin: [15.1, 7.2],
    gap: [2.5, 0],
  },
  a4_24: {
    name: "A4 sheet · 24 per page (70 × 37 mm)",
    page: [210, 297],
    cols: 3,
    rows: 8,
    label: [70, 37],
    margin: [0.5, 0],
    gap: [0, 0],
  },
  thermal: {
    name: "Label printer · 50 × 30 mm",
    page: [50, 30],
    cols: 1,
    rows: 1,
    label: [50, 30],
    margin: [0, 0],
    gap: [0, 0],
  },
} as const;
type LayoutKey = keyof typeof LAYOUTS;

function Barcode({ value, height }: { value: string; height: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height,
        width: 1.4,
        margin: 0,
        fontSize: 11,
        textMargin: 1,
        font: "monospace",
      });
    } catch {
      // Characters CODE128 can't encode; show the code as text instead.
      ref.current.innerHTML = "";
    }
  }, [value, height]);
  return <svg ref={ref} className="max-w-full" role="img" aria-label={`Barcode ${value}`} />;
}

export function LabelSheet({
  initial,
  businessName,
  currency,
  source,
}: {
  initial: LabelItem[];
  businessName: string;
  currency: string;
  source?: string;
}) {
  const [items, setItems] = useState(initial);
  const [layoutKey, setLayoutKey] = useState<LayoutKey>("a4_21");
  const [showPrice, setShowPrice] = useState(true);
  const [skip, setSkip] = useState(0);
  const layout = LAYOUTS[layoutKey];
  const perPage = layout.cols * layout.rows;

  const labels = items.flatMap((item) => Array.from({ length: Math.max(0, item.copies) }, () => item));
  // Leave the first `skip` positions blank so a partly used sticker sheet can be reused.
  const slots: (LabelItem | null)[] = [...Array(layout.cols === 1 ? 0 : skip).fill(null), ...labels];
  const pages: (LabelItem | null)[][] = [];
  for (let i = 0; i < slots.length; i += perPage) pages.push(slots.slice(i, i + perPage));

  const [labelW, labelH] = layout.label;
  const small = labelH < 32;

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: ${layout.page[0]}mm ${layout.page[1]}mm; margin: 0; }
          html, body { background: white !important; }
        }
      `}</style>

      <div className="card space-y-4 p-4 print:hidden">
        {source && <p className="text-muted text-sm">{source}</p>}
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="label text-xs">Label type</span>
            <select
              className="input w-auto"
              value={layoutKey}
              onChange={(e) => setLayoutKey(e.target.value as LayoutKey)}
            >
              {Object.entries(LAYOUTS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          {layout.cols > 1 && (
            <label>
              <span className="label text-xs">Skip used labels</span>
              <input
                type="number"
                min={0}
                max={perPage - 1}
                className="input w-24"
                value={skip}
                onChange={(e) => setSkip(Math.min(perPage - 1, Math.max(0, Number(e.target.value) || 0)))}
              />
            </label>
          )}
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
            Show price
          </label>
          <button
            type="button"
            className="btn btn-primary ml-auto"
            disabled={labels.length === 0}
            onClick={() => window.print()}
          >
            Print {labels.length} label{labels.length === 1 ? "" : "s"}
          </button>
        </div>

        <SkuPicker
          placeholder="Add an item…"
          onPick={(sku) => setItems((list) => [...list, { sku, batch: "", copies: 1 }])}
        />
        {items.length > 0 && (
          <ul className="divide-border divide-y text-sm">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate">
                  {skuLabel(item.sku)} <span className="text-muted font-mono text-xs">{item.sku.code}</span>
                  {item.batch && <span className="text-muted text-xs"> · batch {item.batch}</span>}
                </span>
                <label className="flex items-center gap-1">
                  <span className="text-muted text-xs">Copies</span>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    className="input w-20"
                    value={item.copies}
                    onChange={(e) =>
                      setItems((list) =>
                        list.map((x, j) =>
                          j === i ? { ...x, copies: Math.min(500, Math.max(0, Number(e.target.value) || 0)) } : x,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="text-danger text-xs hover:underline"
                  onClick={() => setItems((list) => list.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted text-xs">
          Tip: print one page on plain paper first and hold it against a sticker sheet to check alignment. In the print
          dialog, set margins to &ldquo;None&rdquo; and scale to 100%.
        </p>
      </div>

      {/* Preview on screen; exactly what prints. */}
      <div className="space-y-4 overflow-x-auto print:space-y-0 print:overflow-visible">
        {pages.map((page, p) => (
          <div
            key={p}
            className="mx-auto bg-white shadow print:mx-0 print:shadow-none"
            style={{
              width: `${layout.page[0]}mm`,
              height: `${layout.page[1]}mm`,
              paddingTop: `${layout.margin[0]}mm`,
              paddingLeft: `${layout.margin[1]}mm`,
              display: "grid",
              gridTemplateColumns: `repeat(${layout.cols}, ${labelW}mm)`,
              gridAutoRows: `${labelH}mm`,
              columnGap: `${layout.gap[0]}mm`,
              rowGap: `${layout.gap[1]}mm`,
              breakAfter: p < pages.length - 1 ? "page" : "auto",
              overflow: "hidden",
            }}
          >
            {page.map((item, i) =>
              item ? (
                <div
                  key={i}
                  className="flex flex-col items-center justify-center overflow-hidden px-[2mm] text-center leading-tight text-black"
                  style={{ width: `${labelW}mm`, height: `${labelH}mm` }}
                >
                  <p className="w-full truncate text-[7pt] text-gray-600">{businessName}</p>
                  <p className={`w-full truncate font-semibold ${small ? "text-[7.5pt]" : "text-[9pt]"}`}>
                    {item.sku.product_name}
                  </p>
                  {(item.sku.variant_label || item.batch) && (
                    <p className="w-full truncate text-[7.5pt]">
                      {[item.sku.variant_label, item.batch && `Batch ${item.batch}`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <Barcode value={item.sku.barcode ?? item.sku.code} height={small ? 22 : 30} />
                  {showPrice && (
                    <p className={`font-bold ${small ? "text-[9pt]" : "text-[11pt]"}`}>
                      {formatMoney(item.sku.promo_price_kobo ?? item.sku.price_kobo, currency)}
                    </p>
                  )}
                </div>
              ) : (
                <div key={i} />
              ),
            )}
          </div>
        ))}
        {pages.length === 0 && (
          <p className="text-muted text-center text-sm print:hidden">Add items above to see the labels.</p>
        )}
      </div>
    </div>
  );
}
