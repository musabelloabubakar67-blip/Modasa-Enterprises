-- Variants that differ in two ways, and a photo for each variant.
--
-- A product can name up to two kinds of option (e.g. "Size" and "Colour"); each SKU then has a value for
-- each. variant_label stays the one text everything else uses (till, labels, receipts, search, reports) and
-- is filled in from the option values, e.g. "5 × 7 ft · Grey". Products without option names keep a typed
-- variant label as before.
--
-- A photo can belong to one variant, so the shop shows the right picture when a customer picks it.
-- Photos without a variant are for the whole product, as before.

alter table public.products
  add column option1_name text check (length(trim(option1_name)) between 1 and 40),
  add column option2_name text check (length(trim(option2_name)) between 1 and 40),
  add constraint second_option_needs_first check (option2_name is null or option1_name is not null);

alter table public.skus
  add column option1 text check (length(trim(option1)) between 1 and 60),
  add column option2 text check (length(trim(option2)) between 1 and 60);

create function public.skus_label_from_options()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.option1 is not null or new.option2 is not null then
    new.variant_label := concat_ws(' · ', new.option1, new.option2);
  end if;
  return new;
end;
$$;

create trigger skus_label_from_options
  before insert or update on public.skus
  for each row execute function public.skus_label_from_options();

-- A variant's photo must be of that same product; deleting the variant keeps the photo for the product.
alter table public.skus add constraint skus_id_product_key unique (id, product_id);
alter table public.product_images
  add column sku_id uuid,
  add constraint product_images_sku_fkey foreign key (sku_id, product_id)
    references public.skus (id, product_id) on delete set null (sku_id);
create index product_images_sku_id_idx on public.product_images (sku_id) where sku_id is not null;

-- save_product: also accept option names on the product and option values on each SKU.
create or replace function public.save_product(payload jsonb)
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
    insert into public.products (name, category_id, unit_id, description, is_active, track_batches, option1_name, option2_name)
    values (
      trim(payload ->> 'name'),
      v_category_id,
      (payload ->> 'unit_id')::uuid,
      nullif(trim(payload ->> 'description'), ''),
      coalesce((payload ->> 'is_active')::boolean, true),
      coalesce((payload ->> 'track_batches')::boolean, false),
      nullif(trim(payload ->> 'option1_name'), ''),
      nullif(trim(payload ->> 'option2_name'), '')
    )
    returning id into v_product_id;
  else
    update public.products set
      name = trim(payload ->> 'name'),
      category_id = coalesce(v_category_id, category_id),
      unit_id = coalesce((payload ->> 'unit_id')::uuid, unit_id),
      description = case when payload ? 'description' then nullif(trim(payload ->> 'description'), '') else description end,
      is_active = coalesce((payload ->> 'is_active')::boolean, is_active),
      track_batches = coalesce((payload ->> 'track_batches')::boolean, track_batches),
      option1_name = case when payload ? 'option1_name' then nullif(trim(payload ->> 'option1_name'), '') else option1_name end,
      option2_name = case when payload ? 'option2_name' then nullif(trim(payload ->> 'option2_name'), '') else option2_name end,
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
        product_id, code, variant_label, option1, option2, price_kobo, promo_price_kobo, barcode,
        roll_width_cm, roll_length_cm, coverage_m2, is_active, sort_order
      ) values (
        v_product_id,
        trim(v_sku ->> 'code'),
        nullif(trim(v_sku ->> 'variant_label'), ''),
        nullif(trim(v_sku ->> 'option1'), ''),
        nullif(trim(v_sku ->> 'option2'), ''),
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
        option1 = case when v_sku ? 'option1' then nullif(trim(v_sku ->> 'option1'), '') else option1 end,
        option2 = case when v_sku ? 'option2' then nullif(trim(v_sku ->> 'option2'), '') else option2 end,
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
