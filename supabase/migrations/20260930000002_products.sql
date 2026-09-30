-- Products: categories, units, products, SKUs, cost prices (restricted), photos.
--
-- A product groups one or more SKUs. Every SKU is a separately stocked and sold item
-- (e.g. "Centre Rug - Turkey" has one SKU per size). Stock, transfers and sales always
-- reference a SKU. Money is stored as integer minor units (kobo) to avoid rounding drift.

create function public.is_manager_or_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() in ('owner', 'manager'), false)
$$;

-- ---------- Units ----------

-- How a unit's coverage is described, so the POS can work out quantities from room sizes.
create type public.unit_coverage as enum ('none', 'roll', 'area');

create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  abbreviation text not null,
  allows_decimal boolean not null default false,
  coverage public.unit_coverage not null default 'none',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Generic defaults every retailer needs; businesses can add more.
insert into public.units (name, abbreviation, allows_decimal, coverage, sort_order) values
  ('Piece', 'pc', false, 'none', 1),
  ('Set', 'set', false, 'none', 2),
  ('Roll', 'roll', false, 'roll', 3),
  ('Box', 'box', false, 'area', 4),
  ('Square metre', 'm²', true, 'none', 5),
  ('Metre', 'm', true, 'none', 6);

-- ---------- Categories ----------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index categories_name_key on public.categories (lower(name));

-- ---------- Products ----------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category_id uuid not null references public.categories (id),
  unit_id uuid not null references public.units (id),
  description text,
  is_active boolean not null default true,
  -- Name + SKU codes, variant labels and barcodes, kept up to date by triggers, for search.
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index products_name_idx on public.products (lower(name));

create table public.skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  code text not null check (code ~ '^\S(.*\S)?$' and length(code) <= 60),
  variant_label text,
  price_kobo bigint not null check (price_kobo >= 0),
  -- Standing sale price. When set, this is what customers pay.
  promo_price_kobo bigint check (promo_price_kobo >= 0),
  -- Supplier barcode, if the item has a reliable one. Otherwise the SKU code is the barcode.
  barcode text check (barcode is null or barcode ~ '^\S+$'),
  -- Coverage, used for units with coverage 'roll' (width x length) or 'area' (m² per unit).
  roll_width_cm numeric(8, 2) check (roll_width_cm > 0),
  roll_length_cm numeric(8, 2) check (roll_length_cm > 0),
  coverage_m2 numeric(8, 3) check (coverage_m2 > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_below_price check (promo_price_kobo is null or promo_price_kobo < price_kobo)
);

create unique index skus_code_key on public.skus (lower(code));
-- What a scanner reads: the barcode if set, otherwise the SKU code. Must identify one SKU.
create unique index skus_scan_code_key on public.skus (lower(coalesce(barcode, code)));
create index skus_product_id_idx on public.skus (product_id);

-- Cost prices live in their own table so row-level security can hide them from floor staff.
create table public.sku_costs (
  sku_id uuid primary key references public.skus (id) on delete cascade,
  cost_kobo bigint not null check (cost_kobo >= 0),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id);

-- ---------- Search text maintenance ----------

create function public.refresh_product_search_text(p_product_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.products p
  set search_text = lower(
    p.name || ' ' || coalesce((
      select string_agg(concat_ws(' ', s.code, s.variant_label, s.barcode), ' ')
      from public.skus s
      where s.product_id = p.id
    ), '')
  )
  where p.id = p_product_id
$$;

create function public.products_search_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'products' then
    perform public.refresh_product_search_text(new.id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_product_search_text(old.product_id);
  else
    perform public.refresh_product_search_text(new.product_id);
    if tg_op = 'UPDATE' and old.product_id <> new.product_id then
      perform public.refresh_product_search_text(old.product_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger products_search_text
  after insert or update of name on public.products
  for each row execute function public.products_search_trigger();

create trigger skus_search_text
  after insert or update or delete on public.skus
  for each row execute function public.products_search_trigger();

-- ---------- Save a product with its SKUs in one transaction ----------
--
-- payload: {
--   id?, name, category_id | category_name, unit_id, description?, is_active?,
--   skus: [{ id?, code, variant_label?, price_kobo, promo_price_kobo?, cost_kobo?, barcode?,
--            roll_width_cm?, roll_length_cm?, coverage_m2?, is_active? }]
-- }
-- Optional keys that are absent leave the stored value unchanged; keys present with null clear it.
-- A SKU without an id is matched by code, so re-saving or re-importing never duplicates it.
-- SKUs are never deleted here; archive them with is_active = false.

create function public.save_product(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_category_id uuid := nullif(payload ->> 'category_id', '')::uuid;
  v_sku jsonb;
  v_sku_id uuid;
  v_existing_product uuid;
begin
  if not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can edit products' using errcode = '42501';
  end if;

  if v_category_id is null and payload ? 'category_name' then
    select id into v_category_id from public.categories where lower(name) = lower(trim(payload ->> 'category_name'));
    if v_category_id is null then
      insert into public.categories (name) values (trim(payload ->> 'category_name')) returning id into v_category_id;
    end if;
  end if;

  if v_product_id is null then
    insert into public.products (name, category_id, unit_id, description, is_active)
    values (
      trim(payload ->> 'name'),
      v_category_id,
      (payload ->> 'unit_id')::uuid,
      nullif(trim(payload ->> 'description'), ''),
      coalesce((payload ->> 'is_active')::boolean, true)
    )
    returning id into v_product_id;
  else
    update public.products set
      name = trim(payload ->> 'name'),
      category_id = coalesce(v_category_id, category_id),
      unit_id = coalesce((payload ->> 'unit_id')::uuid, unit_id),
      description = case when payload ? 'description' then nullif(trim(payload ->> 'description'), '') else description end,
      is_active = coalesce((payload ->> 'is_active')::boolean, is_active),
      updated_at = now()
    where id = v_product_id;
    if not found then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;
  end if;

  for v_sku in select * from jsonb_array_elements(coalesce(payload -> 'skus', '[]'::jsonb)) loop
    v_sku_id := nullif(v_sku ->> 'id', '')::uuid;

    if v_sku_id is null then
      select id, product_id into v_sku_id, v_existing_product
      from public.skus where lower(code) = lower(trim(v_sku ->> 'code'));
      if v_sku_id is not null and v_existing_product <> v_product_id then
        raise exception 'SKU code % already belongs to another product', v_sku ->> 'code' using errcode = '23505';
      end if;
    end if;

    if v_sku_id is null then
      insert into public.skus (
        product_id, code, variant_label, price_kobo, promo_price_kobo, barcode,
        roll_width_cm, roll_length_cm, coverage_m2, is_active, sort_order
      ) values (
        v_product_id,
        trim(v_sku ->> 'code'),
        nullif(trim(v_sku ->> 'variant_label'), ''),
        (v_sku ->> 'price_kobo')::bigint,
        (v_sku ->> 'promo_price_kobo')::bigint,
        nullif(trim(v_sku ->> 'barcode'), ''),
        (v_sku ->> 'roll_width_cm')::numeric,
        (v_sku ->> 'roll_length_cm')::numeric,
        (v_sku ->> 'coverage_m2')::numeric,
        coalesce((v_sku ->> 'is_active')::boolean, true),
        coalesce((v_sku ->> 'sort_order')::int, 0)
      )
      returning id into v_sku_id;
    else
      update public.skus set
        code = trim(v_sku ->> 'code'),
        variant_label = case when v_sku ? 'variant_label' then nullif(trim(v_sku ->> 'variant_label'), '') else variant_label end,
        price_kobo = coalesce((v_sku ->> 'price_kobo')::bigint, price_kobo),
        promo_price_kobo = case when v_sku ? 'promo_price_kobo' then (v_sku ->> 'promo_price_kobo')::bigint else promo_price_kobo end,
        barcode = case when v_sku ? 'barcode' then nullif(trim(v_sku ->> 'barcode'), '') else barcode end,
        roll_width_cm = case when v_sku ? 'roll_width_cm' then (v_sku ->> 'roll_width_cm')::numeric else roll_width_cm end,
        roll_length_cm = case when v_sku ? 'roll_length_cm' then (v_sku ->> 'roll_length_cm')::numeric else roll_length_cm end,
        coverage_m2 = case when v_sku ? 'coverage_m2' then (v_sku ->> 'coverage_m2')::numeric else coverage_m2 end,
        is_active = coalesce((v_sku ->> 'is_active')::boolean, is_active),
        sort_order = coalesce((v_sku ->> 'sort_order')::int, sort_order),
        updated_at = now()
      where id = v_sku_id and product_id = v_product_id;
      if not found then
        raise exception 'SKU % does not belong to this product', v_sku ->> 'code' using errcode = 'P0002';
      end if;
    end if;

    if v_sku ? 'cost_kobo' then
      if v_sku -> 'cost_kobo' = 'null'::jsonb then
        delete from public.sku_costs where sku_id = v_sku_id;
      else
        insert into public.sku_costs (sku_id, cost_kobo) values (v_sku_id, (v_sku ->> 'cost_kobo')::bigint)
        on conflict (sku_id) do update set cost_kobo = excluded.cost_kobo, updated_at = now();
      end if;
    end if;
  end loop;

  return v_product_id;
end;
$$;

-- Import many products atomically: either every row is saved or none are.
create function public.import_products(products jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product jsonb;
  v_count int := 0;
begin
  for v_product in select * from jsonb_array_elements(products) loop
    perform public.save_product(v_product);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------- Row-level security ----------

alter table public.units enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.skus enable row level security;
alter table public.sku_costs enable row level security;
alter table public.product_images enable row level security;

create policy "Staff read units" on public.units for select to authenticated
  using (public.current_staff_role() is not null);
create policy "Managers add units" on public.units for insert to authenticated
  with check (public.is_manager_or_owner());
create policy "Managers edit units" on public.units for update to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

create policy "Staff read categories" on public.categories for select to authenticated
  using (public.current_staff_role() is not null);
create policy "Managers add categories" on public.categories for insert to authenticated
  with check (public.is_manager_or_owner());
create policy "Managers edit categories" on public.categories for update to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

create policy "Staff read products" on public.products for select to authenticated
  using (public.current_staff_role() is not null);
create policy "Managers add products" on public.products for insert to authenticated
  with check (public.is_manager_or_owner());
create policy "Managers edit products" on public.products for update to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

create policy "Staff read SKUs" on public.skus for select to authenticated
  using (public.current_staff_role() is not null);
create policy "Managers add SKUs" on public.skus for insert to authenticated
  with check (public.is_manager_or_owner());
create policy "Managers edit SKUs" on public.skus for update to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

-- Cashiers and warehouse staff cannot see cost prices at all.
create policy "Managers manage costs" on public.sku_costs for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

create policy "Staff read product images" on public.product_images for select to authenticated
  using (public.current_staff_role() is not null);
create policy "Managers add product images" on public.product_images for insert to authenticated
  with check (public.is_manager_or_owner());
create policy "Managers edit product images" on public.product_images for update to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());
create policy "Managers delete product images" on public.product_images for delete to authenticated
  using (public.is_manager_or_owner());

revoke all on public.units, public.categories, public.products, public.skus, public.sku_costs,
  public.product_images from anon;
revoke execute on function public.save_product(jsonb), public.import_products(jsonb) from anon, public;
grant execute on function public.save_product(jsonb), public.import_products(jsonb) to authenticated;

-- ---------- Photo storage ----------

-- Public read so the future storefront can show photos; only managers can upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- Storage needs select alongside delete/update; public URLs don't go through these policies.
create policy "Managers list product images" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_manager_or_owner());
create policy "Managers upload product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_manager_or_owner());
create policy "Managers replace product images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_manager_or_owner());
create policy "Managers delete product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_manager_or_owner());
