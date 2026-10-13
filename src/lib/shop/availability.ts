// How stock is described to customers: where an item is, never how many there are.

export type AvailabilityInfo = { shopIds: string[]; toOrder: boolean; max: number };
export type ShopName = { id: string; name: string };

export function availabilityText(a: AvailabilityInfo, shops: ShopName[], leadTime: string) {
  if (a.shopIds.length > 0) {
    if (shops.length > 1 && a.shopIds.length === shops.length) return "In stock at all shops";
    const names = shops.filter((s) => a.shopIds.includes(s.id)).map((s) => s.name);
    return `In stock at ${names.join(", ")}`;
  }
  if (a.toOrder) return `Available to order · ${leadTime}`;
  return "Out of stock";
}

export function isInStock(a: AvailabilityInfo) {
  return a.shopIds.length > 0;
}
