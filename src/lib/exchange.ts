// An exchange in progress: chosen on the sale's Exchange items page, finished at the till. Kept in the
// browser, per shop, like the till's cart, so it survives a refresh.

export type ExchangeLine = {
  sale_line_id: string;
  quantity: number;
  condition: "restock" | "damaged";
  label: string;
  /** What the customer paid for these items: the credit they bring. The database recomputes it. */
  credit_kobo: number;
};

export type ExchangeDraft = {
  sale_id: string;
  sale_number: string;
  reason: string;
  lines: ExchangeLine[];
  credit_kobo: number;
};

const key = (shopId: string) => `till-exchange:${shopId}`;

export function saveExchange(shopId: string, exchange: ExchangeDraft) {
  try {
    localStorage.setItem(key(shopId), JSON.stringify(exchange));
    return true;
  } catch {
    return false;
  }
}

export function loadExchange(shopId: string): ExchangeDraft | null {
  try {
    const raw = localStorage.getItem(key(shopId));
    return raw ? (JSON.parse(raw) as ExchangeDraft) : null;
  } catch {
    return null;
  }
}

export function clearExchange(shopId: string) {
  try {
    localStorage.removeItem(key(shopId));
  } catch {
    // Nothing to clear.
  }
}
