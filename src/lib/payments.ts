export type PaymentMethod = "cash" | "card" | "transfer" | "online" | "exchange";

/** How each payment method is named on screens and receipts. */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "POS card",
  transfer: "Bank transfer",
  online: "Online (website)",
  exchange: "Exchange credit",
};

/**
 * Methods taken at the till. Online payments never pass through a cash drawer or a till session, and exchange
 * credit is returned items, not money (it nets to zero in cash-ups).
 */
export const TILL_METHODS = ["cash", "card", "transfer"] as const;
