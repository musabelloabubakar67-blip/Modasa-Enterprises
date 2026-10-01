import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import type { LineStock } from "./plan";

// Everything the public website reads. Visitors aren't signed in, so this uses the service role
// with explicit field lists: never cost prices, stock quantities or staff details.

/** Largest quantity of one item in a single online order. */
export const MAX_PER_LINE = 50;
export const PAGE_SIZE = 24;

export type Shop = { id: string; name: string; address: string | null; phone: string | null };
export type ShopCategory = { id: string; name: string; slug: string };

export type Storefront = {
  enabled: boolean;
  businessName: string;
  brand: string;
  tagline: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  openingHours: string | null;
  currency: string;
  heroTitle: string | null;
  heroText: string | null;
  heroImage: string | null;
  leadTime: string;
  returnsNote: string | null;
  shops: Shop[];
  categories: ShopCategory[];
  hasSale: boolean;
};

export const getStorefront = cache(async (): Promise<Storefront> => {
  // Settings, shops and prices change while the site is running: read per request, never at build time.
  await connection();
  const admin = createAdminClient();
  const [settings, locations, categories, listed, sale] = await Promise.all([
    admin
      .from("business_settings")
      .select(
        "name, storefront_name, storefront_enabled, tagline, whatsapp_number, phone, email, opening_hours, currency, hero_title, hero_text, hero_image, order_lead_time, receipt_footer",
      )
      .eq("id", 1)
      .single(),
    admin
      .from("locations")
      .select("id, name, public_name, address, phone")
      .eq("kind", "shop")
      .eq("is_active", true)
      .order("code"),
    admin.from("categories").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    admin.from("storefront_products").select("category_id"),
    admin.from("storefront_products").select("id", { count: "exact", head: true }).eq("on_sale", true),
  ]);
  for (const result of [settings, locations, categories, listed, sale]) if (result.error) throw result.error;

  const s = settings.data!;
  const used = new Set(listed.data!.map((p) => p.category_id));
  return {
    enabled: s.storefront_enabled,
    businessName: s.name,
    brand: s.storefront_name || s.name,
    tagline: s.tagline,
    whatsapp: s.whatsapp_number,
    phone: s.phone,
    email: s.email,
    openingHours: s.opening_hours,
    currency: s.currency,
    heroTitle: s.hero_title,
    heroText: s.hero_text,
    heroImage: s.hero_image,
    leadTime: s.order_lead_time,
    returnsNote: s.receipt_footer,
    shops: locations.data!.map((l) => ({
      id: l.id,
      name: l.public_name || l.name,
      address: l.address,
      phone: l.phone,
    })),
    categories: categories
      .data!.filter((c) => used.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, slug: slugify(c.name) })),
    hasSale: (sale.count ?? 0) > 0,
  };
});

// ---------- Availability ----------

/** What a customer may know about an item's stock: where it is, never how many. */
export type Availability = {
  /** Shops that have it now. */
  shopIds: string[];
  /** Not in any shop, but a warehouse can send it. */
  toOrder: boolean;
  /** The most that can go in one order. 0 means out of stock. */
  max: number;
};

type RawStock = { shops: Record<string, number>; warehouse: number };

/** Stock minus live holds, per item. Server-side only: contains quantities. */
export async function rawStock(skuIds: string[]): Promise<Map<string, RawStock>> {
  const stock = new Map<string, RawStock>(skuIds.map((id) => [id, { shops: {}, warehouse: 0 }]));
  if (skuIds.length === 0) return stock;
  const { data, error } = await createAdminClient().rpc("online_availability", { p_sku_ids: skuIds });
  if (error) throw error;
  for (const row of data) {
    const entry = stock.get(row.sku_id);
    if (!entry) continue;
    const available = Number(row.available);
    if (row.kind === "shop") entry.shops[row.location_id] = Math.max(0, available);
    else entry.warehouse = Math.max(entry.warehouse, available);
  }
  return stock;
}

function toAvailability(stock: RawStock | undefined, shops: Shop[]): Availability {
  if (!stock) return { shopIds: [], toOrder: false, max: 0 };
  const shopIds = shops.filter((s) => (stock.shops[s.id] ?? 0) >= 1).map((s) => s.id);
  const most = Math.max(stock.warehouse, ...shops.map((s) => stock.shops[s.id] ?? 0));
  return {
    shopIds,
    toOrder: shopIds.length === 0 && stock.warehouse >= 1,
    max: Math.min(MAX_PER_LINE, Math.floor(most)),
  };
}

export function toLineStock(skuId: string, quantity: number, stock: RawStock | undefined): LineStock {
  return { skuId, quantity, shops: stock?.shops ?? {}, warehouse: stock?.warehouse ?? 0 };
}

// ---------- Products ----------

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  minPrice: number;
  maxPrice: number;
  /** Highest list price among items on sale, to show struck through when every item shares one price. */
  wasPrice: number | null;
  onSale: boolean;
  options: string | null;
  availability: Availability;
};

export type ProductQuery = {
  categoryId?: string;
  search?: string;
  sale?: boolean;
  featured?: boolean;
  sort?: "featured" | "new" | "price-asc" | "price-desc" | "name";
  page?: number;
  limit?: number;
  excludeId?: string;
};

export async function listProducts(query: ProductQuery): Promise<{ products: ProductCard[]; total: number }> {
  const admin = createAdminClient();
  const limit = query.limit ?? PAGE_SIZE;
  const from = ((query.page ?? 1) - 1) * limit;

  let q = admin.from("storefront_products").select("id", { count: "exact" });
  if (query.categoryId) q = q.eq("category_id", query.categoryId);
  if (query.sale) q = q.eq("on_sale", true);
  if (query.featured) q = q.eq("is_featured", true);
  if (query.excludeId) q = q.neq("id", query.excludeId);
  // Every word must appear somewhere in the name, codes or option labels.
  for (const word of (query.search ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6))
    q = q.ilike("search_text", `%${word.replace(/[%_\\]/g, "\\$&")}%`);

  switch (query.sort) {
    case "new":
      q = q.order("created_at", { ascending: false });
      break;
    case "price-asc":
      q = q.order("min_price_kobo");
      break;
    case "price-desc":
      q = q.order("min_price_kobo", { ascending: false });
      break;
    case "name":
      break;
    default:
      q = q.order("is_featured", { ascending: false });
  }
  const {
    data: rows,
    count,
    error,
  } = await q
    .order("name")
    .order("id")
    .range(from, from + limit - 1);
  if (error) throw error;
  const ids = rows.map((r) => r.id!);
  if (ids.length === 0) return { products: [], total: count ?? 0 };

  const { data, error: detailError } = await admin
    .from("products")
    .select(
      "id, slug, name, skus(id, variant_label, price_kobo, promo_price_kobo, is_active, sort_order), product_images(storage_path, sort_order)",
    )
    .in("id", ids);
  if (detailError) throw detailError;

  const { shops } = await getStorefront();
  const stock = await rawStock(data.flatMap((p) => p.skus.filter((s) => s.is_active).map((s) => s.id)));

  const byId = new Map(data.map((p) => [p.id, p]));
  const products = ids.flatMap((id) => {
    const p = byId.get(id);
    if (!p) return [];
    const skus = p.skus.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);
    if (skus.length === 0) return [];
    const prices = skus.map((s) => s.promo_price_kobo ?? s.price_kobo);
    const each = skus.map((s) => toAvailability(stock.get(s.id), shops));
    const shopIds = shops.filter((s) => each.some((a) => a.shopIds.includes(s.id))).map((s) => s.id);
    const onSale = skus.some((s) => s.promo_price_kobo !== null);
    const labels = skus.map((s) => s.variant_label).filter((l): l is string => !!l);
    return [
      {
        id: p.id,
        slug: p.slug!,
        name: p.name,
        image: [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        wasPrice: skus.length === 1 && onSale ? skus[0].price_kobo : null,
        onSale,
        options: labels.length > 1 ? (labels.length <= 3 ? labels.join(" · ") : `${labels.length} options`) : null,
        availability: {
          shopIds,
          toOrder: shopIds.length === 0 && each.some((a) => a.toOrder),
          max: Math.max(...each.map((a) => a.max)),
        },
      } satisfies ProductCard,
    ];
  });
  return { products, total: count ?? 0 };
}

export type ProductSku = {
  id: string;
  code: string;
  label: string | null;
  price: number;
  listPrice: number;
  rollWidthCm: number | null;
  rollLengthCm: number | null;
  coverageM2: number | null;
  availability: Availability;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: ShopCategory;
  unit: { name: string; abbreviation: string; allowsDecimal: boolean; coverage: "none" | "roll" | "area" };
  images: string[];
  skus: ProductSku[];
};

export const getProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  const { data: p, error } = await createAdminClient()
    .from("products")
    .select(
      `id, slug, name, description, categories(id, name), units(name, abbreviation, allows_decimal, coverage),
       skus(id, code, variant_label, price_kobo, promo_price_kobo, roll_width_cm, roll_length_cm, coverage_m2, is_active, sort_order),
       product_images(storage_path, sort_order)`,
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("show_online", true)
    .maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const skus = p.skus.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);
  if (skus.length === 0) return null;

  const { shops } = await getStorefront();
  const stock = await rawStock(skus.map((s) => s.id));
  return {
    id: p.id,
    slug: p.slug!,
    name: p.name,
    description: p.description,
    category: { id: p.categories.id, name: p.categories.name, slug: slugify(p.categories.name) },
    unit: {
      name: p.units.name,
      abbreviation: p.units.abbreviation,
      allowsDecimal: p.units.allows_decimal,
      coverage: p.units.coverage,
    },
    images: [...p.product_images].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.storage_path),
    skus: skus.map((s) => ({
      id: s.id,
      code: s.code,
      label: s.variant_label,
      price: s.promo_price_kobo ?? s.price_kobo,
      listPrice: s.price_kobo,
      rollWidthCm: s.roll_width_cm,
      rollLengthCm: s.roll_length_cm,
      coverageM2: s.coverage_m2,
      availability: toAvailability(stock.get(s.id), shops),
    })),
  };
});

/** One photo per category for the home page: the first photo of a product in it, featured ones first. */
export async function categoryPhotos(): Promise<Record<string, string>> {
  const { data, error } = await createAdminClient()
    .from("products")
    .select("category_id, is_featured, name, product_images(storage_path, sort_order)")
    .eq("is_active", true)
    .eq("show_online", true)
    .order("is_featured", { ascending: false })
    .order("name")
    .limit(400);
  if (error) throw error;
  const photos: Record<string, string> = {};
  for (const p of data) {
    const first = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
    if (first && !photos[p.category_id]) photos[p.category_id] = first.storage_path;
  }
  return photos;
}

/** Whether anything sold online is measured by the roll or by area (so the calculator is worth showing). */
export async function sellsByCoverage(): Promise<{ rolls: boolean; area: boolean }> {
  const { data, error } = await createAdminClient()
    .from("products")
    .select("units!inner(coverage)")
    .eq("is_active", true)
    .eq("show_online", true)
    .neq("units.coverage", "none")
    .limit(200);
  if (error) throw error;
  return {
    rolls: data.some((p) => p.units.coverage === "roll"),
    area: data.some((p) => p.units.coverage === "area"),
  };
}

// ---------- Cart ----------

export type CartItem = { skuId: string; quantity: number };

export type CartLine = {
  skuId: string;
  quantity: number;
  slug: string;
  name: string;
  label: string | null;
  code: string;
  image: string | null;
  price: number;
  listPrice: number;
  unit: string;
  allowsDecimal: boolean;
  availability: Availability;
};

/** Current details for the items in a cart. Items that are no longer sold online are left out. */
export async function cartLines(items: CartItem[]): Promise<{ lines: CartLine[]; stock: Map<string, RawStock> }> {
  const ids = [...new Set(items.map((i) => i.skuId))];
  if (ids.length === 0) return { lines: [], stock: new Map() };
  const { data, error } = await createAdminClient()
    .from("skus")
    .select(
      `id, code, variant_label, price_kobo, promo_price_kobo, is_active,
       products(slug, name, is_active, show_online, units(abbreviation, allows_decimal), product_images(storage_path, sort_order))`,
    )
    .in("id", ids);
  if (error) throw error;
  const { shops } = await getStorefront();
  const stock = await rawStock(ids);
  const byId = new Map(data.map((s) => [s.id, s]));

  const lines = items.flatMap((item) => {
    const s = byId.get(item.skuId);
    if (!s || !s.is_active || !s.products.is_active || !s.products.show_online) return [];
    return [
      {
        skuId: s.id,
        quantity: item.quantity,
        slug: s.products.slug!,
        name: s.products.name,
        label: s.variant_label,
        code: s.code,
        image: [...s.products.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
        price: s.promo_price_kobo ?? s.price_kobo,
        listPrice: s.price_kobo,
        unit: s.products.units.abbreviation,
        allowsDecimal: s.products.units.allows_decimal,
        availability: toAvailability(stock.get(s.id), shops),
      } satisfies CartLine,
    ];
  });
  return { lines, stock };
}

export type DeliveryArea = { id: string; name: string; fee: number };

export async function deliveryAreas(): Promise<DeliveryArea[]> {
  const { data, error } = await createAdminClient()
    .from("delivery_areas")
    .select("id, name, fee_kobo")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data.map((a) => ({ id: a.id, name: a.name, fee: a.fee_kobo }));
}
