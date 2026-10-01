"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/shop/cart";

/** Empties the browser's cart the first time a paid order's page is opened (not on later visits). */
export function ClearCart({ orderNumber }: { orderNumber: string }) {
  useEffect(() => {
    const key = `cart:cleared:${orderNumber}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      return;
    }
    clearCart();
  }, [orderNumber]);
  return null;
}
