// Works out, for each shop, whether an online order can be handed over there and how soon.
// Mirrors create_online_order in the database: each item is held at the chosen shop if it has
// enough, otherwise at one warehouse that has enough. Other shops' stock is never used.

export type LineStock = {
  skuId: string;
  quantity: number;
  /** Available now at each shop (stock minus live holds). */
  shops: Record<string, number>;
  /** The most any single warehouse has available. */
  warehouse: number;
};

export type LineStatus = "ready" | "transfer" | "unavailable";

export type ShopPlan = {
  shopId: string;
  /** Every item can be supplied through this shop. */
  ok: boolean;
  /** Every item is at the shop now. */
  ready: boolean;
  lines: Record<string, LineStatus>;
};

export function lineStatus(line: LineStock, shopId: string): LineStatus {
  if ((line.shops[shopId] ?? 0) >= line.quantity) return "ready";
  if (line.warehouse >= line.quantity) return "transfer";
  return "unavailable";
}

export function planForShops(lines: LineStock[], shopIds: string[]): ShopPlan[] {
  return shopIds.map((shopId) => {
    const statuses: Record<string, LineStatus> = {};
    for (const line of lines) statuses[line.skuId] = lineStatus(line, shopId);
    const values = Object.values(statuses);
    return {
      shopId,
      ok: !values.includes("unavailable"),
      ready: values.every((s) => s === "ready"),
      lines: statuses,
    };
  });
}

/** The shop a delivery should go out from: one that can supply everything, with the most on hand. */
export function bestShopForDelivery(plans: ShopPlan[]): ShopPlan | null {
  const readyCount = (p: ShopPlan) => Object.values(p.lines).filter((s) => s === "ready").length;
  return (
    plans
      .filter((p) => p.ok)
      .sort((a, b) => readyCount(b) - readyCount(a))
      .at(0) ?? null
  );
}
