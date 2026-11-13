"use client";

import { useEffect, useRef } from "react";
import { lockTill } from "@/app/locked/actions";

/** Minutes without a tap, click, key or scan before the till locks itself. */
export const TILL_IDLE_MINUTES = 2;

const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Locks the till after a pause, so the next person can't sell under the name of whoever walked away.
 * Checked every few seconds against the last activity, which also catches a tablet waking from sleep.
 */
export function TillIdleLock({ locationId }: { locationId: string }) {
  const last = useRef(0);
  const locking = useRef(false);

  useEffect(() => {
    last.current = Date.now();
    const touch = () => (last.current = Date.now());
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
    const timer = window.setInterval(() => {
      if (locking.current || Date.now() - last.current < TILL_IDLE_MINUTES * 60_000) return;
      locking.current = true;
      void lockTill(locationId);
    }, 5_000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      window.clearInterval(timer);
    };
  }, [locationId]);

  return null;
}

/** Locks the till now, for the next person. */
export function SwitchCashierButton({ locationId, className }: { locationId: string; className?: string }) {
  return (
    <form action={lockTill.bind(null, locationId)}>
      <button type="submit" className={className ?? "btn btn-secondary"}>
        Switch cashier
      </button>
    </form>
  );
}
