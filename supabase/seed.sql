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

-- Demo stock. Wallpaper and tiles track batches; the rest don't.
update public.products set track_batches = true where name in ('Wallpaper ALLWP-001', 'Vinyl Floor Tiles');

create temporary table demo_stock (code text, location text, batch text, qty numeric);
insert into demo_stock values
  ('CRUG-001', 'WH-A', '', 18), ('CRUG-001', 'SH1', '', 3), ('CRUG-001', 'SH2', '', 2),
  ('CRUG-002', 'WH-A', '', 12), ('CRUG-002', 'SH1', '', 2), ('CRUG-002', 'SH3', '', 1),
  ('CRUG-003', 'WH-A', '', 6), ('CRUG-003', 'SH2', '', 1),
  ('CRUG-004', 'WH-B', '', 4),
  ('CRUG-005', 'WH-B', '', 10), ('CRUG-005', 'SH1', '', 2),
  ('CRUG-006', 'WH-B', '', 7), ('CRUG-006', 'SH3', '', 1),
  ('ALLWP-001A', 'WH-A', '2304', 40), ('ALLWP-001A', 'WH-A', '2311', 25), ('ALLWP-001A', 'SH1', '2304', 6),
  ('ALLWP-001A', 'SH2', '2311', 4),
  ('ALLWP-001B', 'WH-A', '2306', 30), ('ALLWP-001B', 'SH1', '2306', 5),
  ('ALLWP-001C', 'WH-A', '2302', 22), ('ALLWP-001C', 'SH3', '2302', 3),
  ('ALLWP-001G', 'WH-B', '2401', 12),
  ('VL-68001', 'WH-B', 'L118', 60), ('VL-68001', 'SH2', 'L118', 8),
  ('VL-68012', 'WH-B', 'L121', 45),
  ('VL-68013', 'WH-B', 'L119', 30), ('VL-68013', 'SH3', 'L119', 5),
  ('16395-5', 'WH-A', '', 9), ('16395-5', 'SH1', '', 2),
  ('16395-9', 'WH-A', '', 4), ('16395-10', 'WH-A', '', 3), ('16395-10', 'SH2', '', 1),
  ('GJ0070', 'WH-B', '', 8), ('GJ0070', 'SH1', '', 2), ('GJ0070-1', 'WH-B', '', 5),
  ('SP-26-BLK', 'WH-A', '', 6), ('SP-26-WHT', 'WH-A', '', 4), ('SP-26-WHT', 'SH3', '', 1),
  ('T3-7G', 'WH-B', '', 10), ('T3-7G', 'SH2', '', 2), ('T3-14G', 'WH-B', '', 8), ('T3-36C', 'WH-B', '', 5),
  ('528-2B', 'WH-A', '', 24), ('528-2B', 'SH1', '', 4), ('528-4H', 'WH-A', '', 18), ('528-4H', 'SH3', '', 3),
  ('LX21-KC12S', 'WH-B', '', 30), ('LX21-KC12S', 'SH1', '', 5), ('LX21-KC12S', 'SH2', '', 4),
  ('HM-1', 'WH-A', '', 50), ('HM-1', 'SH1', '', 10), ('HM-1', 'SH2', '', 8), ('HM-1', 'SH3', '', 1),
  ('HM-4', 'WH-A', '', 20), ('HM-4', 'SH3', '', 2);

select public.apply_stock_movement(s.id, l.id, d.batch, d.qty, 'opening', null, null, 'Demo opening stock')
from demo_stock d join public.skus s on s.code = d.code join public.locations l on l.code = d.location;

-- A few reorder levels so the low-stock view has something to show.
insert into public.reorder_levels (sku_id, location_id, reorder_level)
select s.id, l.id, r.level
from (values ('CRUG-002', 'SH3', 2), ('HM-1', 'SH3', 3), ('CRUG-004', 'WH-B', 5), ('LX21-KC12S', 'SH1', 3)) as r(code, loc, level)
join public.skus s on s.code = r.code join public.locations l on l.code = r.loc;

-- Demo transfers: Shop 3 has asked Warehouse A for rugs; wallpaper is on its way to Shop 1.
with t as (
  insert into public.transfers (from_location_id, to_location_id, note)
  select (select id from public.locations where code = 'WH-A'), (select id from public.locations where code = 'SH3'),
         'Running low on 4 × 6 rugs'
  returning id
)
insert into public.transfer_lines (transfer_id, sku_id, requested_quantity, sort_order)
select t.id, s.id, q.qty, q.ord
from t, (values ('CRUG-002', 3, 1), ('HM-1', 5, 2)) as q(code, qty, ord)
join public.skus s on s.code = q.code;

with t as (
  insert into public.transfers (from_location_id, to_location_id, status, dispatched_at)
  select (select id from public.locations where code = 'WH-A'), (select id from public.locations where code = 'SH1'),
         'dispatched', now()
  returning id, number
), l as (
  insert into public.transfer_lines (transfer_id, sku_id, requested_quantity)
  select t.id, s.id, 6 from t, public.skus s where s.code = 'ALLWP-001A'
), i as (
  insert into public.transfer_items (transfer_id, sku_id, batch, dispatched_quantity)
  select t.id, s.id, '2304', 6 from t, public.skus s where s.code = 'ALLWP-001A'
)
select public.apply_stock_movement(s.id, l.id, '2304', -6, 'transfer_out', 'transfer', t.id, t.number || ' → Shop 1')
from t, public.skus s, public.locations l where s.code = 'ALLWP-001A' and l.code = 'WH-A';

-- ---------------------------------------------------------------------------------------------
-- Demo history: 30 days of sales at the three shops, so the dashboard and reports have something
-- to show. Everything goes through the stock ledger so stock and sales stay consistent. Sales have
-- no cashier (test accounts are created after seeding).
-- ---------------------------------------------------------------------------------------------
do $$
declare
  v_shop record;
  v_day date;
  v_shift uuid;
  v_sale uuid;
  v_number text;
  v_sku record;
  v_qty int;
  v_at timestamptz;
  v_total bigint;
  v_cash bigint;
  v_n int;
  v_method public.payment_method;
  v_line uuid;
  v_ret uuid;
begin
  perform setseed(0.42);

  -- Extra stock in the shops 31 days ago (as if transferred in), so a month of sales is possible.
  for v_shop in select id, code from public.locations where kind = 'shop' loop
    for v_sku in select s.id from public.skus s join public.products p on p.id = s.product_id where not p.track_batches loop
      perform public.apply_stock_movement(v_sku.id, v_shop.id, '', 25, 'opening', null, null, 'Demo history stock');
    end loop;
  end loop;
  update public.stock_movements set created_at = now() - interval '31 days' where note = 'Demo history stock';

  for v_day in select generate_series(current_date - 30, current_date - 1, interval '1 day')::date loop
    for v_shop in select id, code from public.locations where kind = 'shop' order by code loop
      insert into public.shifts (location_id, status, opened_at, opening_float_kobo, closed_at)
      values (v_shop.id, 'closed', (v_day + time '08:30') at time zone 'Africa/Lagos', 1000000,
              (v_day + time '19:00') at time zone 'Africa/Lagos')
      returning id into v_shift;
      v_cash := 1000000;

      -- Busier on Saturdays and at Shop 1.
      v_n := 2 + floor(random() * 5)::int + case when extract(isodow from v_day) = 6 then 3 else 0 end
             + case when v_shop.code = 'SH1' then 2 else 0 end;
      for i in 1..v_n loop
        v_at := (v_day + time '09:00' + make_interval(mins => floor(random() * 600)::int)) at time zone 'Africa/Lagos';
        insert into public.sales (location_id, shift_id, subtotal_kobo, total_kobo, created_at)
        values (v_shop.id, v_shift, 0, 0, v_at) returning id, number into v_sale, v_number;
        v_total := 0;

        for v_sku in
          select s.id, coalesce(s.promo_price_kobo, s.price_kobo) as price, s.price_kobo, sl.quantity as have
          from public.skus s
          join public.products p on p.id = s.product_id
          join public.stock_levels sl on sl.sku_id = s.id and sl.location_id = v_shop.id and sl.batch = ''
          where sl.quantity >= 2 and not p.track_batches
          order by random() * (case when s.price_kobo < 2500000 then 1 else 3 end)  -- cheaper items sell more
          limit 1 + floor(random() * 2)::int
        loop
          v_qty := 1 + floor(random() * least(2, v_sku.have - 1))::int;
          insert into public.sale_lines (sale_id, sku_id, quantity, list_price_kobo, unit_price_kobo, line_total_kobo)
          values (v_sale, v_sku.id, v_qty, v_sku.price_kobo, v_sku.price, v_sku.price * v_qty);
          perform public.apply_stock_movement(v_sku.id, v_shop.id, '', -v_qty, 'sale', 'sale', v_sale, v_number);
          v_total := v_total + v_sku.price * v_qty;
        end loop;

        if v_total = 0 then
          delete from public.sales where id = v_sale;
          continue;
        end if;
        v_method := (array['cash', 'cash', 'transfer', 'transfer', 'card'])[1 + floor(random() * 5)::int]::public.payment_method;
        insert into public.sale_payments (sale_id, method, amount_kobo) values (v_sale, v_method, v_total);
        if v_method = 'cash' then v_cash := v_cash + v_total; end if;
        update public.sales set subtotal_kobo = v_total, total_kobo = v_total where id = v_sale;
        update public.stock_movements set created_at = v_at where reference_id = v_sale;
      end loop;

      -- Close the till; Shop 2 comes up ₦500 short now and then.
      update public.shifts set
        expected_cash_kobo = v_cash,
        counted_cash_kobo = v_cash - case when v_shop.code = 'SH2' and random() < 0.2 then 50000 else 0 end,
        expected_card_kobo = (select coalesce(sum(p.amount_kobo), 0) from public.sale_payments p join public.sales s on s.id = p.sale_id where s.shift_id = v_shift and p.method = 'card'),
        expected_transfer_kobo = (select coalesce(sum(p.amount_kobo), 0) from public.sale_payments p join public.sales s on s.id = p.sale_id where s.shift_id = v_shift and p.method = 'transfer')
      where id = v_shift;
      update public.shifts set counted_card_kobo = expected_card_kobo, counted_transfer_kobo = expected_transfer_kobo,
        close_note = case when counted_cash_kobo <> expected_cash_kobo then 'Short — checking' end
      where id = v_shift;
    end loop;
  end loop;

  -- A few returns and write-offs in the history.
  for v_line in
    select l.id from public.sale_lines l join public.sales s on s.id = l.sale_id
    where s.created_at < now() - interval '3 days' order by random() limit 4
  loop
    select s.* into v_shop from public.sales s join public.sale_lines l on l.sale_id = s.id where l.id = v_line;
    insert into public.returns (sale_id, location_id, shift_id, refund_method, refund_kobo, reason, created_at)
    select s.id, s.location_id, s.shift_id, 'cash', l.unit_price_kobo, 'Customer changed their mind', s.created_at + interval '1 day'
    from public.sales s join public.sale_lines l on l.sale_id = s.id where l.id = v_line
    returning id into v_ret;
    insert into public.return_lines (return_id, sale_line_id, quantity, condition, refund_kobo)
    select v_ret, l.id, 1, 'restock', l.unit_price_kobo from public.sale_lines l where l.id = v_line;
    update public.sale_lines set returned_quantity = returned_quantity + 1 where id = v_line;
    perform public.apply_stock_movement(l.sku_id, s.location_id, '', 1, 'return', 'return', v_ret, 'Demo return')
    from public.sale_lines l join public.sales s on s.id = l.sale_id where l.id = v_line;
  end loop;

  perform public.apply_stock_movement(s.id, l.id, '', -1, 'damage', null, null, 'Broken · dropped while unpacking')
  from public.skus s, public.locations l where s.code = 'T3-7G' and l.code = 'WH-B';
  perform public.apply_stock_movement(s.id, l.id, '', -2, 'damage', null, null, 'Water damage · roof leak')
  from public.skus s, public.locations l where s.code = 'HM-4' and l.code = 'WH-A';
  update public.stock_movements set created_at = now() - interval '12 days' where note like 'Broken%' or note like 'Water%';
end $$;

-- Online shop demo settings.
update public.business_settings set
  tagline = 'Rugs, wallpaper, furniture and home décor',
  whatsapp_number = '08030000000',
  opening_hours = 'Mon–Sat 9am–7pm'
where id = 1;

update public.locations set address = v.address, phone = v.phone
from (values
  ('SH1', '12 Admiralty Way, Lekki Phase 1, Lagos', '0803 000 0001'),
  ('SH2', '45 Allen Avenue, Ikeja, Lagos', '0803 000 0002'),
  ('SH3', '8 Adeniran Ogunsanya Street, Surulere, Lagos', '0803 000 0003')
) as v(code, address, phone)
where locations.code = v.code;

insert into public.delivery_areas (name, fee_kobo, sort_order) values
  ('Lekki / Ajah', 350000, 1), ('Victoria Island / Ikoyi', 300000, 2), ('Ikeja / Maryland', 300000, 3),
  ('Surulere / Yaba', 250000, 4), ('Other Lagos mainland', 450000, 5);

update public.products set show_online = true;
update public.products set is_featured = true
where name in ('Centre Rug – Turkey', 'Wallpaper ALLWP-001', '2-in-1 Centre Table', 'Ceramic Dishes');
