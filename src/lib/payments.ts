export type PaymentMethod = "cash" | "card" | "transfer" | "online";

/** How each payment method is named on screens and receipts. */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "POS card",
  transfer: "Bank transfer",
  online: "Online (website)",
};

/** Methods taken at the till. Online payments never pass through a cash drawer or a till session. */
export const TILL_METHODS = ["cash", "card", "transfer"] as const;
