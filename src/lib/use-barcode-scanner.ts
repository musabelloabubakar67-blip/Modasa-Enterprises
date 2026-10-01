"use client";

import { useEffect, useRef } from "react";

/** A scanner "types" a whole code in a few milliseconds; people take 100ms+ per key. */
const MAX_GAP_MS = 50;
const MAX_AVERAGE_MS = 40;
const MIN_LENGTH = 4;

type Editable = HTMLInputElement | HTMLTextAreaElement;

function setNativeValue(el: Editable, value: string) {
  // Set through the native setter so React notices the change.
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Catches barcode scans anywhere on the page, even when the cursor is in another box (e.g. the
 * customer's name). Scanners act as keyboards: they type the code very fast and press Enter. When a
 * burst like that ends, the typed characters are removed from whatever box they landed in and the
 * code is passed to `onScan`. Inputs marked `data-scan-target` handle scans themselves and are left alone.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let started = 0;
    let last = 0;
    let target: Editable | null = null;
    let snapshot = "";

    function onKeyDown(e: KeyboardEvent) {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("[data-scan-target]")) return; // the search box handles its own scans
      const now = performance.now();

      if (e.key === "Enter") {
        const fast =
          buffer.length >= MIN_LENGTH &&
          now - last < MAX_GAP_MS &&
          (last - started) / (buffer.length - 1 || 1) < MAX_AVERAGE_MS;
        if (fast) {
          e.preventDefault();
          e.stopPropagation();
          if (target && target.value !== snapshot) setNativeValue(target, snapshot);
          handler.current(buffer);
        }
        buffer = "";
        return;
      }
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      if (now - last > MAX_GAP_MS) {
        // A new burst: remember the box and what was in it before the first character landed.
        buffer = "";
        started = now;
        target = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
        snapshot = target?.value ?? "";
      }
      buffer += e.key;
      last = now;
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
