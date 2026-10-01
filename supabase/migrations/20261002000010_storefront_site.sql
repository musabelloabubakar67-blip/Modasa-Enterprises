-- Online shop, part 2: what the website shows about the business, and the customer's payment link.

-- The name customers see for a shop, e.g. "Lekki" (staff screens keep using the location name).
alter table public.locations add column public_name text;

alter table public.business_settings
  -- Short brand name for the website header, e.g. "Modasa". Falls back to the business name.
  add column storefront_name text,
  add column hero_title text,
  add column hero_text text,
  -- Photo behind the home page headline: a path in the product-images bucket, or a full web address.
  add column hero_image text,
  -- Shown beside items that must come from a warehouse first.
  add column order_lead_time text not null default '2–3 days';

-- Where the customer goes to pay (or resume paying) for an order.
alter table public.online_orders add column payment_url text;

-- One row per product shown on the website, with its price range, for listing, sorting and paging.
create view public.storefront_products with (security_invoker = true) as
select
  p.id, p.slug, p.name, p.is_featured, p.created_at, p.category_id, p.search_text,
  min(coalesce(s.promo_price_kobo, s.price_kobo)) as min_price_kobo,
  max(coalesce(s.promo_price_kobo, s.price_kobo)) as max_price_kobo,
  bool_or(s.promo_price_kobo is not null) as on_sale,
  count(s.id)::int as sku_count
from public.products p
join public.skus s on s.product_id = p.id and s.is_active
where p.is_active and p.show_online
group by p.id;

revoke all on public.storefront_products from anon;
