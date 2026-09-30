// Display names shared by server and client components.

export const MOVEMENT_LABELS: Record<string, string> = {
  opening: "Opening stock",
  receipt: "Delivery",
  transfer_out: "Transfer out",
  transfer_in: "Transfer in",
  sale: "Sale",
  return: "Return",
  damage: "Write-off",
  count_correction: "Count correction",
};

export const ADJUSTMENT_LABELS = {
  opening: "Opening stock",
  count: "Stock count",
  damage: "Damage write-off",
} as const;
