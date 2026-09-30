"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
      {items.map((item) => {
        const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);

        if (item.soon) {
          return (
            <span
              key={item.href}
              className="text-muted/70 flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm"
            >
              {item.label}
              <span className="bg-background rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase">Soon</span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-md px-3 py-2 text-sm ${
              active ? "bg-accent/10 text-accent font-medium" : "hover:bg-background"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
