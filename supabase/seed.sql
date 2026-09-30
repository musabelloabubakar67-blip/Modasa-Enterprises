-- Local development seed. The owner account is created through the /setup page.

update public.business_settings
set name = 'Modasa Enterprises',
    currency = 'NGN',
    receipt_footer = 'Thank you for shopping with us. Goods in good condition may be exchanged within 7 days with a receipt.'
where id = 1;

insert into public.locations (name, code, kind, address) values
  ('Shop 1', 'SH1', 'shop', null),
  ('Shop 2', 'SH2', 'shop', null),
  ('Shop 3', 'SH3', 'shop', null),
  ('Warehouse A', 'WH-A', 'warehouse', null),
  ('Warehouse B', 'WH-B', 'warehouse', null);

-- Demo catalogue based on the kinds of items Modasa sells. Prices come from their sample
-- sheets where available; cost prices, coverage figures and missing prices are illustrative.

insert into public.categories (name, sort_order) values
  ('Rugs', 1), ('Wallpaper', 2), ('Flooring', 3), ('Furniture', 4), ('Décor', 5), ('Kitchen & Dining', 6), ('Home Essentials', 7);

create temporary table demo_products (
  key text, name text, category text, unit text, description text
);

insert into demo_products values
  ('rug-turkey', 'Centre Rug – Turkey', 'Rugs', 'Piece', 'Turkish-made centre rug. Sizes in feet.'),
  ('rug-shaggy', 'Centre Rug – Shaggy', 'Rugs', 'Piece', 'Soft shaggy centre rug. Sizes in feet.'),
  ('wallpaper', 'Wallpaper ALLWP-001', 'Wallpaper', 'Roll', 'Standard roll, 53 cm × 10 m.'),
  ('vinyl', 'Vinyl Floor Tiles', 'Flooring', 'Box', 'Self-adhesive vinyl tiles.'),
  ('coffee-table', '1 Stand Coffee Table', 'Furniture', 'Piece', null),
  ('centre-table', '2-in-1 Centre Table', 'Furniture', 'Piece', null),
  ('metal-decor', 'Metal Ornament GJ0070', 'Décor', 'Piece', 'Metal table-top ornament.'),
  ('fireplace', 'LED Fireplace', 'Décor', 'Piece', 'Electric LED fireplace insert.'),
  ('dishes', 'Ceramic Dishes', 'Kitchen & Dining', 'Set', null),
  ('knife-set', 'Knife Set', 'Kitchen & Dining', 'Set', null),
  ('laundry', 'Laundry Basket', 'Home Essentials', 'Piece', null),
  ('footmat', 'Foot Mat', 'Home Essentials', 'Piece', null);

create temporary table demo_product_ids as
with inserted as (
  insert into public.products (name, category_id, unit_id, description)
  select d.name, c.id, u.id, d.description
  from demo_products d
  join public.categories c on c.name = d.category
  join public.units u on u.name = d.unit
  returning id, name
)
select d.key, i.id from inserted i join demo_products d on d.name = i.name;

-- key, code, variant, price (naira), promo (naira), cost (naira), roll width cm, roll length cm, m² per unit
create temporary table demo_skus (
  key text, code text, variant text, price numeric, promo numeric, cost numeric,
  roll_w numeric, roll_l numeric, m2 numeric, sort int
);

insert into demo_skus values
  ('rug-turkey', 'CRUG-001', '3 × 5', 40000, null, 26000, null, null, null, 1),
  ('rug-turkey', 'CRUG-002', '4 × 6', 70000, null, 45000, null, null, null, 2),
  ('rug-turkey', 'CRUG-003', '5 × 7', 130000, 120000, 84000, null, null, null, 3),
  ('rug-turkey', 'CRUG-004', '7 × 10', 150000, null, 97000, null, null, null, 4),
  ('rug-shaggy', 'CRUG-005', '3 × 5', 40000, null, 25000, null, null, null, 1),
  ('rug-shaggy', 'CRUG-006', '4 × 6', 75000, null, 47000, null, null, null, 2),
  ('wallpaper', 'ALLWP-001A', 'Design A', 4500, null, 2600, 53, 1000, null, 1),
  ('wallpaper', 'ALLWP-001B', 'Design B', 5500, null, 3200, 53, 1000, null, 2),
  ('wallpaper', 'ALLWP-001C', 'Design C', 6000, null, 3500, 53, 1000, null, 3),
  ('wallpaper', 'ALLWP-001G', 'Design G (premium)', 15000, null, 9000, 53, 1000, null, 4),
  ('vinyl', 'VL-68001', 'Brown', 18000, null, 11000, null, null, 3.34, 1),
  ('vinyl', 'VL-68012', 'Grey', 18000, null, 11000, null, null, 3.34, 2),
  ('vinyl', 'VL-68013', 'Light Cream', 18000, null, 11000, null, null, 3.34, 3),
  ('coffee-table', '16395-5', null, 22000, null, 14000, null, null, null, 1),
  ('centre-table', '16395-9', 'Black', 65000, null, 41000, null, null, null, 1),
  ('centre-table', '16395-10', 'Gold', 68000, null, 43000, null, null, null, 2),
  ('metal-decor', 'GJ0070', 'Standard', 38250, null, null, null, null, null, 1),
  ('metal-decor', 'GJ0070-1', 'Large', 43475, null, null, null, null, null, 2),
  ('fireplace', 'SP-26-BLK', 'Big · Black', 25000, null, 16000, null, null, null, 1),
  ('fireplace', 'SP-26-WHT', 'Big · White', 26000, null, 16500, null, null, null, 2),
  ('dishes', 'T3-7G', 'White & Gold Stripe', 85000, null, 55000, null, null, null, 1),
  ('dishes', 'T3-14G', 'Plain White', 85000, null, 55000, null, null, null, 2),
  ('dishes', 'T3-36C', 'Black & Gold Stripe', 90625, null, 58000, null, null, null, 3),
  ('knife-set', '528-2B', '6 pcs', 14400, null, 9000, null, null, null, 1),
  ('knife-set', '528-4H', '9 pcs', 19000, null, 12000, null, null, null, 2),
  ('laundry', 'LX21-KC12S', null, 21000, null, 13000, null, null, null, 1),
  ('footmat', 'HM-1', 'Leg mat', 5500, null, 3000, null, null, null, 1),
  ('footmat', 'HM-4', 'Fur mat (big)', 10125, null, 6000, null, null, null, 2);

with inserted as (
  insert into public.skus (product_id, code, variant_label, price_kobo, promo_price_kobo, roll_width_cm, roll_length_cm, coverage_m2, sort_order)
  select p.id, s.code, s.variant, (s.price * 100)::bigint, (s.promo * 100)::bigint, s.roll_w, s.roll_l, s.m2, s.sort
  from demo_skus s join demo_product_ids p on p.key = s.key
  returning id, code
)
insert into public.sku_costs (sku_id, cost_kobo)
select i.id, (s.cost * 100)::bigint from inserted i join demo_skus s on s.code = i.code where s.cost is not null;
