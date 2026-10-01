"use client";

import { useEffect } from "react";

/** Opens the print dialog once the receipt has rendered (silent in kiosk mode). */
export function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
