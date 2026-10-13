import { productImageUrl } from "@/lib/products";

// Stock placeholders shown until the business uploads its own photographs.
export const PLACEHOLDER = {
  hero: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace",
  calculator: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6",
};

/**
 * Web address for a photo at roughly the width it is shown. Photos are either uploaded
 * (a storage path) or linked from elsewhere (a full address).
 */
export function photoUrl(path: string, width: number) {
  if (!/^https?:\/\//.test(path)) return productImageUrl(path);
  if (path.includes("images.unsplash.com")) return `${path.split("?")[0]}?auto=format&fit=crop&q=70&w=${width}`;
  return path;
}
