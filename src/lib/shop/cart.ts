"use client";

import { useSyncExternalStore } from "react";

// The cart lives in the customer's browser (there are no customer accounts). It only stores which
// items and how many; names, prices and availability are always looked up fresh from the server.

export type CartItem = { skuId: string; quantity: number };

const KEY = "cart:v1";
const CHANGED = "cart:changed";
const EMPTY: CartItem[] = [];

let cachedRaw: string | null = null;
let cachedItems: CartItem[] = EMPTY;

function read(): CartItem[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Private browsing with storage blocked: the cart just stays empty.
  }
  if (raw === cachedRaw) return cachedItems;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedItems = Array.isArray(parsed)
      ? parsed.filter(
          (i): i is CartItem => typeof i?.skuId === "string" && typeof i?.quantity === "number" && i.quantity > 0,
        )
      : EMPTY;
  } catch {
    cachedItems = EMPTY;
  }
  return cachedItems;
}

function write(items: CartItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** The cart's contents. Empty while the page is still loading. */
export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** True once the browser's saved cart has been read (so "your cart is empty" isn't shown too early). */
export function useCartReady() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function addToCart(skuId: string, quantity: number, max: number) {
  const items = read();
  const existing = items.find((i) => i.skuId === skuId);
  const next = Math.min(max, (existing?.quantity ?? 0) + quantity);
  write(
    existing
      ? items.map((i) => (i.skuId === skuId ? { ...i, quantity: next } : i))
      : [...items, { skuId, quantity: next }],
  );
}

export function setQuantity(skuId: string, quantity: number) {
  const items = read();
  write(
    quantity > 0
      ? items.map((i) => (i.skuId === skuId ? { ...i, quantity } : i))
      : items.filter((i) => i.skuId !== skuId),
  );
}

export function clearCart() {
  write([]);
}
