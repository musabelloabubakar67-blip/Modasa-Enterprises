export const STAFF_ROLES = ["owner", "manager", "cashier", "warehouse"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  warehouse: "Warehouse staff",
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner: "Full access, including settings, locations and staff.",
  manager: "Runs day-to-day operations across all locations.",
  cashier: "Sells and receives transfers at one shop.",
  warehouse: "Receives, stores and dispatches stock at one warehouse.",
};

/** Roles that must be tied to a single location. */
export function roleNeedsLocation(role: StaffRole) {
  return role === "cashier" || role === "warehouse";
}

export const LOCATION_KINDS = ["shop", "warehouse"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];
