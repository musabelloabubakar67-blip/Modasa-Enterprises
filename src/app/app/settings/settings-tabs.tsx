"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/settings", label: "Business" },
  { href: "/app/settings/locations", label: "Locations" },
  { href: "/app/settings/staff", label: "Staff" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-border mt-4 flex gap-1 border-b">
      {TABS.map((tab) => {
        const active = tab.href === "/app/settings" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              active ? "border-accent text-accent font-medium" : "text-muted hover:text-foreground border-transparent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
