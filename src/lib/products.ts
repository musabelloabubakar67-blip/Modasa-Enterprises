import { env } from "@/lib/env";

export const PRODUCT_IMAGES_BUCKET = "product-images";

/**
 * Widths (longest side) every product photo is uploaded at, as `<folder>/<width>.webp`. The largest is the
 * path stored in product_images; the others sit next to it.
 */
export const PHOTO_WIDTHS = [400, 800, 1600] as const;
const LARGEST = /\/1600\.webp$/;

/** Every stored file of a photo, so removing it removes all its sizes. */
export function photoFiles(storagePath: string) {
  return LARGEST.test(storagePath)
    ? PHOTO_WIDTHS.map((w) => storagePath.replace(LARGEST, `/${w}.webp`))
    : [storagePath];
}

/**
 * Web address of a photo. Uploaded photos (a storage path) come in several sizes: with `width`, the smallest
 * one at least that wide. Photos from before sizes existed, and full web addresses, are shown as they are.
 */
export function productImageUrl(storagePath: string, width?: number) {
  if (/^https?:\/\//.test(storagePath)) return storagePath;
  let path = storagePath;
  if (width && LARGEST.test(path)) {
    const size = PHOTO_WIDTHS.find((w) => w >= width) ?? PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1];
    path = path.replace(LARGEST, `/${size}.webp`);
  }
  return `${env.supabaseUrl}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path}`;
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
