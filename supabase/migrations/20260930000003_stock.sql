-- Stock: an append-only movement ledger, current levels per SKU/location/batch, receiving at
-- warehouses, and adjustments (opening stock, counts, damage) with manager approval.
--
-- Stock is never edited directly. Every change is a row in stock_movements, written only by the
-- security-definer functions below, which also keep stock_levels in step inside the same transaction.

-- ---------- Batch tracking switch on products ----------

alter table public.products add column track_batches boolean not null default false;

comment on column public.products.track_batches is
  'Stock is kept per production batch (dye lot), e.g. wallpaper, so sales can avoid mixing shades.';

-- save_product: also accept track_batches.
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
    insert into public.products (name, category_id, unit_id, description, is_active, track_batches)
    values (
      trim(payload ->> 'name'),
      v_category_id,
      (payload ->> 'unit_id')::uuid,
      nullif(trim(payload ->> 'description'), ''),
      coalesce((payload ->> 'is_active')::boolean, true),
      coalesce((payload ->> 'track_batches')::boolean, false)
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

-- ---------- Ledger and levels ----------

create type public.movement_type as enum (
  'opening', 'receipt', 'transfer_out', 'transfer_in', 'sale', 'return', 'damage', 'count_correction'
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  sku_id uuid not null references public.skus (id),
  location_id uuid not null references public.locations (id),
  -- '' means "no batch" (products that don't track batches, or stock from before tracking began).
  batch text not null default '',
  -- Signed: positive adds stock, negative removes it.
  quantity numeric(12, 3) not null check (quantity <> 0),
  type public.movement_type not null,
  -- The document that caused it, e.g. ('receipt', <receipt id>).
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index stock_movements_sku_idx on public.stock_movements (sku_id, created_at desc);
create index stock_movements_location_idx on public.stock_movements (location_id, created_at desc);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_reference_idx on public.stock_movements (reference_type, reference_id);

create table public.stock_levels (
  sku_id uuid not null references public.skus (id),
  location_id uuid not null references public.locations (id),
  batch text not null default '',
  quantity numeric(12, 3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (sku_id, location_id, batch)
);

create index stock_levels_location_idx on public.stock_levels (location_id);

-- Optional minimum per SKU per location; at or below it the SKU is flagged as low.
create table public.reorder_levels (
  sku_id uuid not null references public.skus (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  reorder_level numeric(12, 3) not null check (reorder_level >= 0),
  primary key (sku_id, location_id)
);

-- ---------- Internal helpers (not callable by clients) ----------

create function public.assert_can_act_at(p_location_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() is null then
    raise exception 'Not signed in as active staff' using errcode = '42501';
  end if;
  if not public.is_manager_or_owner() and public.current_staff_location() is distinct from p_location_id then
    raise exception 'You can only do this at your own location' using errcode = '42501';
  end if;
end;
$$;

-- The single place stock changes. Validates units, updates the level, refuses to go negative.
create function public.apply_stock_movement(
  p_sku_id uuid,
  p_location_id uuid,
  p_batch text,
  p_quantity numeric,
  p_type public.movement_type,
  p_reference_type text,
  p_reference_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allows_decimal boolean;
  v_code text;
  v_location text;
  v_new numeric;
begin
  select u.allows_decimal, s.code into v_allows_decimal, v_code
  from public.skus s join public.products p on p.id = s.product_id join public.units u on u.id = p.unit_id
  where s.id = p_sku_id;
  if v_code is null then
    raise exception 'Unknown SKU' using errcode = 'P0002';
  end if;
  if not v_allows_decimal and p_quantity <> trunc(p_quantity) then
    raise exception '% is sold in whole units; % is not a whole number', v_code, p_quantity using errcode = '22023';
  end if;

  insert into public.stock_movements (
    sku_id, location_id, batch, quantity, type, reference_type, reference_id, note, created_by
  ) values (
    p_sku_id, p_location_id, coalesce(trim(p_batch), ''), p_quantity, p_type, p_reference_type, p_reference_id,
    p_note, auth.uid()
  );

  insert into public.stock_levels (sku_id, location_id, batch, quantity)
  values (p_sku_id, p_location_id, coalesce(trim(p_batch), ''), p_quantity)
  on conflict (sku_id, location_id, batch)
  do update set quantity = public.stock_levels.quantity + excluded.quantity, updated_at = now()
  returning quantity into v_new;

  if v_new < 0 then
    select name into v_location from public.locations where id = p_location_id;
    raise exception 'Not enough stock: % at % would go to %', v_code, v_location, v_new using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.apply_stock_movement(uuid, uuid, text, numeric, public.movement_type, text, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.assert_can_act_at(uuid) from public, anon;

-- ---------- Receiving (warehouses only) ----------

create type public.receipt_status as enum ('draft', 'posted', 'cancelled');

create sequence public.receipt_number_seq;

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default 'GRN-' || lpad(nextval('public.receipt_number_seq')::text, 5, '0'),
  location_id uuid not null references public.locations (id),
  supplier_name text,
  supplier_reference text,
  received_on date not null default current_date,
  note text,
  status public.receipt_status not null default 'draft',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  posted_by uuid references public.profiles (id),
  posted_at timestamptz
);

create index receipts_location_idx on public.receipts (location_id, created_at desc);

create table public.receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  sku_id uuid not null references public.skus (id),
  batch text not null default '',
  quantity numeric(12, 3) not null check (quantity > 0),
  sort_order int not null default 0
);

create index receipt_lines_receipt_idx on public.receipt_lines (receipt_id);

-- Unit costs are kept apart so warehouse staff can receive goods without seeing what they cost.
create table public.receipt_costs (
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  sku_id uuid not null references public.skus (id),
  unit_cost_kobo bigint not null check (unit_cost_kobo >= 0),
  primary key (receipt_id, sku_id)
);

-- payload: { id?, location_id, supplier_name?, supplier_reference?, received_on?, note?,
--            lines: [{ sku_id, batch?, quantity, unit_cost_kobo? }] }
-- Replaces all lines of a draft. unit_cost_kobo is only accepted from owners/managers.
create function public.save_receipt(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_location uuid := (payload ->> 'location_id')::uuid;
  v_status public.receipt_status;
  v_line jsonb;
  v_order int := 0;
  v_is_manager boolean := public.is_manager_or_owner();
begin
  perform public.assert_can_act_at(v_location);
  if public.current_staff_role() = 'cashier' then
    raise exception 'Cashiers cannot receive stock' using errcode = '42501';
  end if;
  if (select kind from public.locations where id = v_location) is distinct from 'warehouse' then
    raise exception 'Deliveries can only be received at a warehouse' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.receipts (location_id, supplier_name, supplier_reference, received_on, note, created_by)
    values (
      v_location,
      nullif(trim(payload ->> 'supplier_name'), ''),
      nullif(trim(payload ->> 'supplier_reference'), ''),
      coalesce((payload ->> 'received_on')::date, current_date),
      nullif(trim(payload ->> 'note'), ''),
      auth.uid()
    )
    returning id into v_id;
  else
    select status into v_status from public.receipts where id = v_id for update;
    if v_status is null then
      raise exception 'Delivery not found' using errcode = 'P0002';
    end if;
    if v_status <> 'draft' then
      raise exception 'Only draft deliveries can be changed' using errcode = '22023';
    end if;
    perform public.assert_can_act_at((select location_id from public.receipts where id = v_id));
    update public.receipts set
      location_id = v_location,
      supplier_name = nullif(trim(payload ->> 'supplier_name'), ''),
      supplier_reference = nullif(trim(payload ->> 'supplier_reference'), ''),
      received_on = coalesce((payload ->> 'received_on')::date, received_on),
      note = nullif(trim(payload ->> 'note'), '')
    where id = v_id;
    delete from public.receipt_lines where receipt_id = v_id;
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(payload -> 'lines', '[]'::jsonb)) loop
    v_order := v_order + 1;
    insert into public.receipt_lines (receipt_id, sku_id, batch, quantity, sort_order)
    values (v_id, (v_line ->> 'sku_id')::uuid, coalesce(trim(v_line ->> 'batch'), ''), (v_line ->> 'quantity')::numeric, v_order);

    if v_is_manager and v_line ? 'unit_cost_kobo' then
      if v_line -> 'unit_cost_kobo' = 'null'::jsonb then
        delete from public.receipt_costs where receipt_id = v_id and sku_id = (v_line ->> 'sku_id')::uuid;
      else
        insert into public.receipt_costs (receipt_id, sku_id, unit_cost_kobo)
        values (v_id, (v_line ->> 'sku_id')::uuid, (v_line ->> 'unit_cost_kobo')::bigint)
        on conflict (receipt_id, sku_id) do update set unit_cost_kobo = excluded.unit_cost_kobo;
      end if;
    end if;
  end loop;

  -- Drop costs for SKUs no longer on the delivery.
  delete from public.receipt_costs c
  where c.receipt_id = v_id and not exists (
    select 1 from public.receipt_lines l where l.receipt_id = v_id and l.sku_id = c.sku_id
  );

  return v_id;
end;
$$;

-- Adds the delivered stock and updates cost prices. After this the delivery can't change.
create function public.post_receipt(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.receipts;
  v_line record;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id for update;
  if v_receipt.id is null then
    raise exception 'Delivery not found' using errcode = 'P0002';
  end if;
  perform public.assert_can_act_at(v_receipt.location_id);
  if public.current_staff_role() = 'cashier' then
    raise exception 'Cashiers cannot receive stock' using errcode = '42501';
  end if;
  if v_receipt.status <> 'draft' then
    raise exception 'This delivery has already been %', v_receipt.status using errcode = '22023';
  end if;
  if not exists (select 1 from public.receipt_lines where receipt_id = p_receipt_id) then
    raise exception 'Add at least one item before posting' using errcode = '22023';
  end if;

  for v_line in
    select l.*, s.code, p.track_batches
    from public.receipt_lines l
    join public.skus s on s.id = l.sku_id
    join public.products p on p.id = s.product_id
    where l.receipt_id = p_receipt_id
    order by l.sort_order
  loop
    if v_line.track_batches and v_line.batch = '' then
      raise exception '% needs a batch number', v_line.code using errcode = '22023';
    end if;
    perform public.apply_stock_movement(
      v_line.sku_id, v_receipt.location_id, v_line.batch, v_line.quantity, 'receipt', 'receipt', p_receipt_id,
      concat_ws(' · ', v_receipt.number, v_receipt.supplier_name)
    );
  end loop;

  -- The latest delivery cost becomes the SKU's cost price.
  insert into public.sku_costs (sku_id, cost_kobo, updated_at)
  select sku_id, unit_cost_kobo, now() from public.receipt_costs where receipt_id = p_receipt_id
  on conflict (sku_id) do update set cost_kobo = excluded.cost_kobo, updated_at = now();

  update public.receipts set status = 'posted', posted_by = auth.uid(), posted_at = now() where id = p_receipt_id;
end;
$$;

create function public.cancel_receipt(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.receipts;
begin
  select * into v_receipt from public.receipts where id = p_receipt_id for update;
  if v_receipt.id is null then
    raise exception 'Delivery not found' using errcode = 'P0002';
  end if;
  perform public.assert_can_act_at(v_receipt.location_id);
  if v_receipt.status <> 'draft' then
    raise exception 'Only drafts can be cancelled. Correct a posted delivery with a stock adjustment.' using errcode = '22023';
  end if;
  update public.receipts set status = 'cancelled' where id = p_receipt_id;
end;
$$;

-- ---------- Adjustments: opening stock, counts, damage ----------

create type public.adjustment_kind as enum ('opening', 'count', 'damage');
create type public.adjustment_status as enum ('pending', 'approved', 'rejected');

create sequence public.adjustment_number_seq;

create table public.adjustments (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default 'ADJ-' || lpad(nextval('public.adjustment_number_seq')::text, 5, '0'),
  location_id uuid not null references public.locations (id),
  kind public.adjustment_kind not null,
  status public.adjustment_status not null default 'pending',
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text
);

create index adjustments_status_idx on public.adjustments (status, created_at desc);
create index adjustments_location_idx on public.adjustments (location_id, created_at desc);

create table public.adjustment_lines (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.adjustments (id) on delete cascade,
  sku_id uuid not null references public.skus (id),
  batch text not null default '',
  -- opening/count: the quantity counted. damage: the quantity written off.
  quantity numeric(12, 3) not null check (quantity >= 0),
  -- What the system showed when the count was taken; the correction is quantity - system_quantity,
  -- so sales made between counting and approval aren't wiped out.
  system_quantity numeric(12, 3) not null default 0,
  reason text,
  sort_order int not null default 0,
  unique (adjustment_id, sku_id, batch)
);

create index adjustment_lines_adjustment_idx on public.adjustment_lines (adjustment_id);

create function public.approve_adjustment(p_adjustment_id uuid, p_review_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adj public.adjustments;
  v_line record;
  v_diff numeric;
begin
  if not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can approve adjustments' using errcode = '42501';
  end if;
  select * into v_adj from public.adjustments where id = p_adjustment_id for update;
  if v_adj.id is null then
    raise exception 'Adjustment not found' using errcode = 'P0002';
  end if;
  if v_adj.status <> 'pending' then
    raise exception 'This adjustment has already been %', v_adj.status using errcode = '22023';
  end if;

  for v_line in
    select l.* from public.adjustment_lines l where l.adjustment_id = p_adjustment_id order by l.sort_order
  loop
    if v_adj.kind = 'damage' then
      v_diff := -v_line.quantity;
    else
      v_diff := v_line.quantity - v_line.system_quantity;
    end if;
    if v_diff <> 0 then
      perform public.apply_stock_movement(
        v_line.sku_id, v_adj.location_id, v_line.batch, v_diff,
        case v_adj.kind when 'damage' then 'damage' when 'opening' then 'opening' else 'count_correction' end::public.movement_type,
        'adjustment', p_adjustment_id,
        concat_ws(' · ', v_adj.number, v_line.reason, v_adj.note)
      );
    end if;
  end loop;

  update public.adjustments
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_review_note), '')
  where id = p_adjustment_id;
end;
$$;

create function public.reject_adjustment(p_adjustment_id uuid, p_review_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can reject adjustments' using errcode = '42501';
  end if;
  update public.adjustments
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_review_note), '')
  where id = p_adjustment_id and status = 'pending';
  if not found then
    raise exception 'Only pending adjustments can be rejected' using errcode = '22023';
  end if;
end;
$$;

-- payload: { location_id, kind, note?, lines: [{ sku_id, batch?, quantity, reason? }] }
-- Floor staff submit for approval at their own location; owners/managers are approved immediately.
create function public.submit_adjustment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_location uuid := (payload ->> 'location_id')::uuid;
  v_kind public.adjustment_kind := (payload ->> 'kind')::public.adjustment_kind;
  v_line jsonb;
  v_order int := 0;
  v_track boolean;
  v_code text;
  v_batch text;
begin
  perform public.assert_can_act_at(v_location);
  if v_kind = 'opening' and not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can enter opening stock' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(payload -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one item' using errcode = '22023';
  end if;

  insert into public.adjustments (location_id, kind, note, created_by)
  values (v_location, v_kind, nullif(trim(payload ->> 'note'), ''), auth.uid())
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(payload -> 'lines') loop
    v_order := v_order + 1;
    v_batch := coalesce(trim(v_line ->> 'batch'), '');
    select p.track_batches, s.code into v_track, v_code
    from public.skus s join public.products p on p.id = s.product_id where s.id = (v_line ->> 'sku_id')::uuid;
    if v_code is null then
      raise exception 'Unknown SKU' using errcode = 'P0002';
    end if;
    if not v_track and v_batch <> '' then
      raise exception '% does not track batches', v_code using errcode = '22023';
    end if;
    if v_kind = 'damage' and (v_line ->> 'quantity')::numeric <= 0 then
      raise exception 'Damage quantity for % must be more than zero', v_code using errcode = '22023';
    end if;

    insert into public.adjustment_lines (adjustment_id, sku_id, batch, quantity, system_quantity, reason, sort_order)
    values (
      v_id,
      (v_line ->> 'sku_id')::uuid,
      v_batch,
      (v_line ->> 'quantity')::numeric,
      coalesce((
        select quantity from public.stock_levels
        where sku_id = (v_line ->> 'sku_id')::uuid and location_id = v_location and batch = v_batch
      ), 0),
      nullif(trim(v_line ->> 'reason'), ''),
      v_order
    );
  end loop;

  if public.is_manager_or_owner() then
    perform public.approve_adjustment(v_id, 'Entered by a manager');
  end if;

  return v_id;
end;
$$;

-- ---------- Reorder levels ----------

create function public.set_reorder_level(p_sku_id uuid, p_location_id uuid, p_level numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can set reorder levels' using errcode = '42501';
  end if;
  if p_level is null then
    delete from public.reorder_levels where sku_id = p_sku_id and location_id = p_location_id;
  else
    insert into public.reorder_levels (sku_id, location_id, reorder_level) values (p_sku_id, p_location_id, p_level)
    on conflict (sku_id, location_id) do update set reorder_level = excluded.reorder_level;
  end if;
end;
$$;

-- ---------- Row-level security: everything is read-only to clients; writes go through functions ----------

alter table public.stock_movements enable row level security;
alter table public.stock_levels enable row level security;
alter table public.reorder_levels enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_lines enable row level security;
alter table public.receipt_costs enable row level security;
alter table public.adjustments enable row level security;
alter table public.adjustment_lines enable row level security;

-- Everyone can see quantities everywhere (needed for "available at another location").
create policy "Staff read stock levels" on public.stock_levels for select to authenticated
  using (public.current_staff_role() is not null);
create policy "Staff read stock movements" on public.stock_movements for select to authenticated
  using (public.current_staff_role() is not null);
create policy "Staff read reorder levels" on public.reorder_levels for select to authenticated
  using (public.current_staff_role() is not null);

create policy "Managers and warehouse staff read deliveries" on public.receipts for select to authenticated
  using (public.is_manager_or_owner() or (public.current_staff_role() = 'warehouse' and location_id = public.current_staff_location()));
create policy "Managers and warehouse staff read delivery lines" on public.receipt_lines for select to authenticated
  using (exists (select 1 from public.receipts r where r.id = receipt_id));
create policy "Managers read delivery costs" on public.receipt_costs for select to authenticated
  using (public.is_manager_or_owner());

create policy "Staff read adjustments" on public.adjustments for select to authenticated
  using (public.is_manager_or_owner() or location_id = public.current_staff_location());
create policy "Staff read adjustment lines" on public.adjustment_lines for select to authenticated
  using (exists (select 1 from public.adjustments a where a.id = adjustment_id));

revoke all on public.stock_movements, public.stock_levels, public.reorder_levels, public.receipts,
  public.receipt_lines, public.receipt_costs, public.adjustments, public.adjustment_lines from anon;
revoke insert, update, delete, truncate on public.stock_movements, public.stock_levels, public.reorder_levels,
  public.receipts, public.receipt_lines, public.receipt_costs, public.adjustments, public.adjustment_lines
  from authenticated;

revoke execute on function
  public.save_receipt(jsonb), public.post_receipt(uuid), public.cancel_receipt(uuid),
  public.submit_adjustment(jsonb), public.approve_adjustment(uuid, text), public.reject_adjustment(uuid, text),
  public.set_reorder_level(uuid, uuid, numeric)
  from public, anon;
grant execute on function
  public.save_receipt(jsonb), public.post_receipt(uuid), public.cancel_receipt(uuid),
  public.submit_adjustment(jsonb), public.approve_adjustment(uuid, text), public.reject_adjustment(uuid, text),
  public.set_reorder_level(uuid, uuid, numeric)
  to authenticated;

-- ---------- Read views (security_invoker: the caller's row-level security applies) ----------

-- Quantity per SKU per location, all batches combined.
create view public.sku_location_stock with (security_invoker = true) as
select sku_id, location_id, sum(quantity) as quantity
from public.stock_levels
group by sku_id, location_id;

-- One row per active SKU with its total stock and whether any location is at/below its reorder level.
create view public.stock_overview with (security_invoker = true) as
select
  s.id as sku_id,
  s.code,
  s.variant_label,
  s.sort_order,
  p.id as product_id,
  p.name as product_name,
  p.category_id,
  p.search_text,
  p.track_batches,
  u.abbreviation as unit,
  coalesce(t.quantity, 0) as total_quantity,
  exists (
    select 1 from public.reorder_levels r
    left join public.sku_location_stock ls on ls.sku_id = r.sku_id and ls.location_id = r.location_id
    where r.sku_id = s.id and coalesce(ls.quantity, 0) <= r.reorder_level
  ) as is_low
from public.skus s
join public.products p on p.id = s.product_id
join public.units u on u.id = p.unit_id
left join (select sku_id, sum(quantity) as quantity from public.stock_levels group by sku_id) t on t.sku_id = s.id
where s.is_active and p.is_active;

revoke all on public.sku_location_stock, public.stock_overview from anon;
grant select on public.sku_location_stock, public.stock_overview to authenticated;

-- Names (only) of staff, so history can show who did what without exposing colleagues' contact
-- details. Runs as the view owner, and filters to active staff callers itself.
create view public.staff_directory as
select id, full_name, role
from public.profiles
where public.current_staff_role() is not null;

revoke all on public.staff_directory from anon;
grant select on public.staff_directory to authenticated;
