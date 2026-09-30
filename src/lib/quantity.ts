/** 12 -> "12", 2.5 -> "2.5", 2.125 -> "2.125". */
export function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "");
}
