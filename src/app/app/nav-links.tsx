"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

type Badges = Promise<Record<string, number>>;

export function NavLinks({ items, badges }: { items: NavItem[]; badges: Badges }) {
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
            <Suspense>
              <Badge badges={badges} href={item.href} />
            </Suspense>
          </Link>
        );
      })}
    </nav>
  );
}

/** The count of things waiting under a menu item; appears when the counts arrive. */
function Badge({ badges, href }: { badges: Badges; href: string }) {
  const count = use(badges)[href];
  if (!count) return null;
  return (
    <span className="bg-accent text-accent-foreground ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
      {count}
    </span>
  );
}
