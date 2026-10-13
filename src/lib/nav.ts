import type { StaffRole } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  roles: readonly StaffRole[];
  /** Planned but not built yet; shown greyed out so staff can see what's coming. */
  soon?: boolean;
  /** Number of things waiting for this person (set per request). */
  badge?: number;
};

const ALL: readonly StaffRole[] = ["owner", "manager", "cashier", "warehouse"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Home", roles: ALL },
  { href: "/app/pos", label: "Point of sale", roles: ["owner", "manager", "cashier"] },
  { href: "/app/sales", label: "Sales", roles: ["owner", "manager", "cashier"] },
  { href: "/app/online-orders", label: "Online orders", roles: ["owner", "manager", "cashier"] },
  { href: "/app/stock", label: "Stock", roles: ALL },
  { href: "/app/transfers", label: "Transfers", roles: ALL },
  { href: "/app/products", label: "Products", roles: ALL },
  { href: "/app/reports", label: "Reports", roles: ["owner", "manager"] },
  { href: "/app/settings", label: "Settings", roles: ["owner"] },
];

export function navFor(role: StaffRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
