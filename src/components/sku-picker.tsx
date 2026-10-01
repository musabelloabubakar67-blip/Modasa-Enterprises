"use client";

import { useEffect, useRef, useState } from "react";
import { searchSkus, type SkuOption } from "@/app/app/stock/actions";

/**
 * Search box for picking a SKU by name, code or barcode. Works with a USB/Bluetooth scanner:
 * scanners type the code then press Enter, and an exact match is picked immediately.
 */
export function SkuPicker({
  onPick,
  placeholder = "Search or scan an item…",
  autoFocus,
}: {
  onPick: (sku: SkuOption) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  // Results always remember which text they were for, so a slow reply to an earlier search can
  // never be picked for a newer one (scanners send codes back-to-back faster than searches return).
  const [results, setResults] = useState<{ for: string; items: SkuOption[] }>({ for: "", items: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const latest = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    const id = ++latest.current; // bumped on every change, including clearing, to drop stale replies
    if (!q) return;
    const timer = setTimeout(async () => {
      const found = await searchSkus(q);
      if (id !== latest.current) return; // the text has changed since
      setResults({ for: q, items: found });
      setActive(0);
      setOpen(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(sku: SkuOption) {
    onPick(sku);
    setQuery("");
    setResults({ for: "", items: [] });
    setOpen(false);
    setMessage(null);
    inputRef.current?.focus();
  }

  async function onEnter() {
    const q = query.trim();
    if (!q) return;
    // Scanners press Enter before the debounced search runs, so search now unless we already have
    // results for exactly this text.
    const found = results.for === q ? results.items : await searchSkus(q);
    if (inputRef.current && inputRef.current.value.trim() !== q) return; // another scan has started
    const exact = found.find((s) => s.code.toLowerCase() === q.toLowerCase());
    if (exact) return pick(exact);
    if (found[active]) return pick(found[active]);
    setMessage(`Nothing found for “${q}”.`);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input"
        value={query}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-controls="sku-picker-results"
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value);
          setMessage(null);
          if (!e.target.value.trim()) {
            setResults({ for: "", items: [] });
            setOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {message && <p className="text-danger mt-1 text-xs">{message}</p>}
      {open && query.trim() && (
        <ul
          id="sku-picker-results"
          role="listbox"
          className="card absolute z-20 mt-1 max-h-80 w-full overflow-y-auto py-1 shadow-lg"
        >
          {results.items.length === 0 && <li className="text-muted px-3 py-2 text-sm">No matching items.</li>}
          {results.items.map((sku, i) => (
            <li
              key={sku.id}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent/10" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(sku);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="font-medium">{sku.product_name}</span>
              {sku.variant_label && <span> · {sku.variant_label}</span>}
              <span className="text-muted ml-2 font-mono text-xs">{sku.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function skuLabel(sku: { product_name: string; variant_label: string | null }) {
  return sku.variant_label ? `${sku.product_name} · ${sku.variant_label}` : sku.product_name;
}
