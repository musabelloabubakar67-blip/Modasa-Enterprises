import { env } from "@/lib/env";

export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Photos are normally uploaded (a storage path); a full web address is shown as it is. */
export function productImageUrl(storagePath: string) {
  if (/^https?:\/\//.test(storagePath)) return storagePath;
  return `${env.supabaseUrl}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${storagePath}`;
}

export type UnitCoverage = "none" | "roll" | "area";

export type Unit = {
  id: string;
  name: string;
  abbreviation: string;
  allows_decimal: boolean;
  coverage: UnitCoverage;
};

export type Category = { id: string; name: string; is_active: boolean };

/** The price a customer actually pays: the sale price if one is set. */
export function sellingPrice(sku: { price_kobo: number; promo_price_kobo: number | null }) {
  return sku.promo_price_kobo ?? sku.price_kobo;
}

export function canEditProducts(role: string) {
  return role === "owner" || role === "manager";
}
