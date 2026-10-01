"use client";

import Link from "next/link";
import { useCart } from "@/lib/shop/cart";
import { BagIcon } from "./icons";

export function CartLink() {
  const count = useCart().length;
  return (
    <Link
      href="/cart"
      className="hover:text-accent inline-flex min-h-11 items-center gap-2 transition-colors"
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <BagIcon />
      <span className="hidden sm:inline">Cart</span>
      <span className="tabular-nums">({count})</span>
    </Link>
  );
}
