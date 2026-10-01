"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { searchSkus, type SkuOption } from "@/app/app/stock/actions";
import { useBarcodeScanner } from "@/lib/use-barcode-scanner";
import { CameraScanner } from "./camera-scanner";

const noopSubscribe = () => () => {};
const hasCamera = () => !!navigator.mediaDevices?.getUserMedia;

/**
 * Search box for picking a SKU by name, code or barcode. Works with a USB/Bluetooth scanner:
 * scanners type the code then press Enter, and an exact match is picked immediately. With
 * `captureScans`, scans are also caught when the cursor is in another box on the page.
 */
export function SkuPicker({
  onPick,
  placeholder = "Scan a barcode or type to search…",
  autoFocus,
  captureScans = false,
}: {
  onPick: (sku: SkuOption) => void;
  placeholder?: string;
  autoFocus?: boolean;
  captureScans?: boolean;
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

  function pick(sku: SkuOption, { keepFocus = false } = {}) {
    onPick(sku);
    setQuery("");
    setResults({ for: "", items: [] });
    setOpen(false);
    setMessage(null);
    // After a scan caught elsewhere, leave the cursor where the cashier put it.
    if (!keepFocus) inputRef.current?.focus();
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

  // A scan caught elsewhere on the page (or by the camera): look up that exact code or barcode only.
  async function onScan(code: string) {
    const found = await searchSkus(code);
    const lower = code.toLowerCase();
    const match = found.find((s) => s.code.toLowerCase() === lower || s.barcode?.toLowerCase() === lower);
    if (match) {
      pick(match, { keepFocus: true });
      return { ok: true, text: `Added: ${skuLabel(match)}` };
    }
    const text = `Scanned “${code}” — no item has that code or barcode.`;
    setMessage(text);
    return { ok: false, text };
  }

  const cameraAvailable = useSyncExternalStore(noopSubscribe, hasCamera, () => false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraResult, setCameraResult] = useState<{ ok: boolean; text: string } | null>(null);
  useBarcodeScanner(onScan, captureScans);

  // A scanner can only type into the active window, so show whether this one is ready.
  const [windowActive, setWindowActive] = useState(true);
  useEffect(() => {
    if (!captureScans) return;
    const update = () => setWindowActive(document.hasFocus());
    update();
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, [captureScans]);

  return (
    <div className="relative">
      <div className="relative">
        <BarcodeIcon />
        <input
          ref={inputRef}
          data-scan-target
          className="input pr-24 pl-10"
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
        {cameraAvailable && (
          <button
            type="button"
            className="text-muted hover:text-accent absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1.5 text-xs"
            onClick={() => {
              setCameraResult(null);
              setCameraOpen(true);
            }}
            aria-label="Scan with camera"
            title="Scan with this device's camera"
          >
            <CameraIcon />
            <span className="hidden sm:inline">Camera</span>
          </button>
        )}
        {/* Results drop down directly under the input. */}
        {open && query.trim() && (
          <ul
            id="sku-picker-results"
            role="listbox"
            className="card absolute top-full z-20 mt-1 max-h-80 w-full overflow-y-auto py-1 shadow-lg"
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
      {captureScans && (
        <p className={`mt-1 flex items-center gap-1.5 text-xs ${windowActive ? "text-success" : "text-amber-700"}`}>
          <span
            className={`inline-block h-2 w-2 rounded-full ${windowActive ? "bg-success" : "bg-amber-500"}`}
            aria-hidden="true"
          />
          {windowActive
            ? "Ready to scan — scan any item, wherever the cursor is."
            : "Click anywhere on this window, then scan. (Another window is active.)"}
        </p>
      )}
      {message && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {message}
        </p>
      )}
      {cameraOpen && (
        <CameraScanner
          lastResult={cameraResult}
          onClose={() => setCameraOpen(false)}
          onCode={async (code) => setCameraResult(await onScan(code))}
        />
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function BarcodeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="text-muted pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2"
      aria-hidden="true"
      fill="currentColor"
    >
      <rect x="2" y="4" width="2" height="16" />
      <rect x="6" y="4" width="1" height="16" />
      <rect x="9" y="4" width="2" height="16" />
      <rect x="13" y="4" width="1" height="16" />
      <rect x="16" y="4" width="3" height="16" />
      <rect x="21" y="4" width="1" height="16" />
    </svg>
  );
}

export function skuLabel(sku: { product_name: string; variant_label: string | null }) {
  return sku.variant_label ? `${sku.product_name} · ${sku.variant_label}` : sku.product_name;
}
