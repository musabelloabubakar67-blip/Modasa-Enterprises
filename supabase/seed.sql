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
