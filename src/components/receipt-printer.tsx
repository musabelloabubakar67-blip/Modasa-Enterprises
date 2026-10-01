"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { desktopConfig, isDesktop, openTillSettings, printRaw } from "@/lib/desktop";
import { EscPos } from "@/lib/escpos";
import { receiptToEscPos } from "@/lib/receipt-escpos";
import { getReceiptForPrint, logDrawerOpen } from "@/app/app/sales/actions";

/**
 * Prints a sale's receipt. In the desktop till app it goes straight to the receipt printer (and opens
 * the drawer for cash sales when `auto`); in a browser it opens the printable receipt page instead.
 */
export function ReceiptPrinter({
  saleId,
  auto = false,
  copy = false,
  className = "btn btn-secondary",
  label = "Print receipt",
}: {
  saleId: string;
  /** Print as soon as this appears (right after a sale). */
  auto?: boolean;
  /** Mark the printout as a copy (reprints). */
  copy?: boolean;
  className?: string;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "printing" | "printed" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const print = useCallback(
    async (openDrawerForCash: boolean) => {
      if (!isDesktop()) {
        window.open(`/app/sales/${saleId}/receipt?print=1`, "_blank", "noopener");
        return;
      }
      setStatus("printing");
      setError(null);
      try {
        const [data, config] = await Promise.all([getReceiptForPrint(saleId), desktopConfig()]);
        if (!data || !config) throw new Error("Couldn't load the receipt.");
        if (!config.receipt_printer)
          throw new Error("No receipt printer is set up. Open till settings (Ctrl+Shift+S).");
        await printRaw(
          receiptToEscPos(data.sale, data.business, {
            width: config.paper_width,
            cashierName: data.cashierName,
            openDrawer: openDrawerForCash && config.cash_drawer && data.paidCash,
            copyLabel: copy ? "*** COPY ***" : undefined,
          }),
        );
        setStatus("printed");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [saleId, copy],
  );

  useEffect(() => {
    if (auto && isDesktop() && !started.current) {
      started.current = true;
      print(true);
    }
  }, [auto, print]);

  return (
    <div className="space-y-1">
      <button type="button" className={className} disabled={status === "printing"} onClick={() => print(false)}>
        {status === "printing" ? "Printing…" : status === "printed" ? "Printed ✓ — print again" : label}
      </button>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/** "No sale" drawer opening: asks why, logs it against the till session, then pops the drawer. */
export function OpenDrawerButton({ locationId }: { locationId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    desktopConfig().then((c) => setEnabled(!!c?.cash_drawer && !!c.receipt_printer));
  }, []);
  if (!enabled) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={async () => {
          const reason = prompt("Why are you opening the drawer? (e.g. change for a customer)");
          if (!reason?.trim()) return;
          const result = await logDrawerOpen(locationId, reason);
          if (result.error) return setMessage(result.error);
          try {
            await printRaw(new EscPos(48).openDrawer().toBytes());
            setMessage(null);
          } catch (e) {
            setMessage(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        Open drawer
      </button>
      {message && <span className="text-danger text-xs">{message}</span>}
    </div>
  );
}

const noopSubscribe = () => () => {};

/** Shown only in the desktop till app: opens this PC's till settings (printer, drawer, server). */
export function TillSettingsButton() {
  // false while rendering on the server, then whether the page is inside the desktop app.
  const desktop = useSyncExternalStore(noopSubscribe, isDesktop, () => false);
  const [error, setError] = useState<string | null>(null);
  if (!desktop) return null;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn btn-secondary"
        title="Printer, cash drawer and server for this PC (Ctrl+Shift+S)"
        onClick={() => openTillSettings().catch((e) => setError(String(e)))}
      >
        Till settings
      </button>
      {error && <span className="text-danger text-xs">{error}</span>}
    </div>
  );
}
