// Money is stored as integer minor units (kobo for NGN) and only converted at the edges.

export function formatMoney(minor: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/**
 * Parses what a person types ("18,500", "₦18500.50", "18500") into minor units.
 * Returns null for blank input and NaN for anything that isn't a valid non-negative amount.
 */
export function parseMoney(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : NaN;
  const cleaned = input.replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned) * 100);
}

/** Minor units to a plain editable string, e.g. 1850050 -> "18500.50". */
export function toMoneyInput(minor: number | null | undefined) {
  if (minor === null || minor === undefined) return "";
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}
