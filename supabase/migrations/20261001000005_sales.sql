-- Point of sale: till sessions (for cash-up), customers, sales paid in full (split payments allowed),
-- collection/delivery details, receipts and returns. Shops sell only their own stock.

-- ---------- VAT switch ----------

alter table public.business_settings
  add column vat_enabled boolean not null default false,
  add column vat_rate numeric(5, 2) not null default 7.5 check (vat_rate >= 0 and vat_rate < 100),
  add column vat_number text;

comment on column public.business_settings.vat_enabled is
  'Prices always include VAT. When enabled, receipts show the VAT portion of the total.';

-- ---------- Customers ----------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Stored as digits only, e.g. 08031112222, so the same customer is found however it is typed.
  phone text unique check (phone ~ '^[0-9]{7,15}$'),
  email text,
  address text,
  created_at timestamptz not null default now()
);

create index customers_name_idx on public.customers (lower(name));

-- ---------- Till sessions ----------

create type public.shift_status as enum ('open', 'closed');

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  status public.shift_status not null default 'open',
  opened_by uuid references public.profiles (id),
  opened_at timestamptz not null default now(),
  opening_float_kobo bigint not null check (opening_float_kobo >= 0),
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  counted_cash_kobo bigint check (counted_cash_kobo >= 0),
  counted_card_kobo bigint check (counted_card_kobo >= 0),
  counted_transfer_kobo bigint check (counted_transfer_kobo >= 0),
  -- Expected amounts are frozen at closing so later corrections can't change the record.
  expected_cash_kobo bigint,
  expected_card_kobo bigint,
  expected_transfer_kobo bigint,
  close_note text
);

-- One open till per shop at a time.
create unique index shifts_one_open_per_location on public.shifts (location_id) where status = 'open';
create index shifts_location_idx on public.shifts (location_id, opened_at desc);

-- ---------- Sales ----------

create type public.payment_method as enum ('cash', 'card', 'transfer');
create type public.fulfilment as enum ('taken', 'collect_later', 'delivery');
create type public.fulfilment_status as enum ('pending', 'out_for_delivery', 'completed');

create sequence public.sale_number_seq;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default 'INV-' || lpad(nextval('public.sale_number_seq')::text, 6, '0'),
  location_id uuid not null references public.locations (id),
  shift_id uuid not null references public.shifts (id),
  customer_id uuid references public.customers (id),
  cashier_id uuid references public.profiles (id),
  -- Sum of line totals; delivery fee is separate; total = subtotal + delivery fee.
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  total_kobo bigint not null check (total_kobo >= 0),
  -- VAT included in the total, recorded only when VAT was switched on at the time of sale.
  vat_rate numeric(5, 2),
  vat_kobo bigint not null default 0,
  fulfilment public.fulfilment not null default 'taken',
  fulfilment_status public.fulfilment_status not null default 'completed',
  fulfilment_updated_at timestamptz,
  fulfilment_updated_by uuid references public.profiles (id),
  delivery_address text,
  delivery_area text,
  delivery_date date,
  note text,
  -- Unguessable token for the customer's online receipt link.
  receipt_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  constraint delivery_needs_address check (fulfilment <> 'delivery' or delivery_address is not null)
);

create index sales_location_idx on public.sales (location_id, created_at desc);
create index sales_shift_idx on public.sales (shift_id);
create index sales_customer_idx on public.sales (customer_id);
create index sales_fulfilment_idx on public.sales (location_id, fulfilment_status) where fulfilment_status <> 'completed';

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  sku_id uuid not null references public.skus (id),
  batch text not null default '',
  quantity numeric(12, 3) not null check (quantity > 0),
  -- The normal price and the price actually charged (the sale price, if one was set).
  list_price_kobo bigint not null,
  unit_price_kobo bigint not null,
  line_total_kobo bigint not null,
  returned_quantity numeric(12, 3) not null default 0 check (returned_quantity >= 0 and returned_quantity <= quantity),
  sort_order int not null default 0
);

create index sale_lines_sale_idx on public.sale_lines (sale_id);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  method public.payment_method not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  -- Cash handed over, so the receipt can show change.
  tendered_kobo bigint check (tendered_kobo >= amount_kobo),
  reference text
);

create index sale_payments_sale_idx on public.sale_payments (sale_id);

-- ---------- Returns ----------

create sequence public.return_number_seq;

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default 'RET-' || lpad(nextval('public.return_number_seq')::text, 5, '0'),
  sale_id uuid not null references public.sales (id),
  location_id uuid not null references public.locations (id),
  shift_id uuid not null references public.shifts (id),
  refund_method public.payment_method not null,
  refund_kobo bigint not null check (refund_kobo >= 0),
  reason text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index returns_sale_idx on public.returns (sale_id);
create index returns_shift_idx on public.returns (shift_id);

create type public.return_condition as enum ('restock', 'damaged');

create table public.return_lines (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns (id) on delete cascade,
  sale_line_id uuid not null references public.sale_lines (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  condition public.return_condition not null,
  refund_kobo bigint not null check (refund_kobo >= 0)
);

-- ---------- Helpers ----------

create function public.assert_can_sell_at(p_location_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_can_act_at(p_location_id);
  if public.current_staff_role() = 'warehouse' then
    raise exception 'Warehouse staff cannot use the till' using errcode = '42501';
  end if;
  if (select kind from public.locations where id = p_location_id) is distinct from 'shop' then
    raise exception 'Sales can only be made at a shop' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.assert_can_sell_at(uuid) from public, anon;

create function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '')
$$;

-- ---------- Shifts ----------

create function public.open_shift(p_location_id uuid, p_float_kobo bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.assert_can_sell_at(p_location_id);
  if p_float_kobo is null or p_float_kobo < 0 then
    raise exception 'Enter the cash float (0 if none)' using errcode = '22023';
  end if;
  if exists (select 1 from public.shifts where location_id = p_location_id and status = 'open') then
    raise exception 'The till at this shop is already open' using errcode = '22023';
  end if;
  insert into public.shifts (location_id, opened_by, opening_float_kobo)
  values (p_location_id, auth.uid(), p_float_kobo)
  returning id into v_id;
  return v_id;
end;
$$;

-- What should be in the drawer / terminal / bank for a shift: float + sales - refunds, per method.
create function public.shift_expected(p_shift_id uuid)
returns table (method public.payment_method, sales_kobo bigint, refunds_kobo bigint, expected_kobo bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with m(method) as (select unnest(enum_range(null::public.payment_method))),
  paid as (
    select p.method, sum(p.amount_kobo)::bigint as amount
    from public.sale_payments p join public.sales s on s.id = p.sale_id
    where s.shift_id = p_shift_id group by p.method
  ),
  refunded as (
    select r.refund_method as method, sum(r.refund_kobo)::bigint as amount
    from public.returns r where r.shift_id = p_shift_id group by r.refund_method
  )
  select
    m.method,
    coalesce(paid.amount, 0),
    coalesce(refunded.amount, 0),
    coalesce(paid.amount, 0) - coalesce(refunded.amount, 0)
      + case when m.method = 'cash' then (select opening_float_kobo from public.shifts where id = p_shift_id) else 0 end
  from m
  left join paid on paid.method = m.method
  left join refunded on refunded.method = m.method
$$;

create function public.close_shift(
  p_shift_id uuid,
  p_counted_cash bigint,
  p_counted_card bigint,
  p_counted_transfer bigint,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.shifts;
begin
  select * into v_shift from public.shifts where id = p_shift_id for update;
  if v_shift.id is null then
    raise exception 'Till session not found' using errcode = 'P0002';
  end if;
  perform public.assert_can_sell_at(v_shift.location_id);
  if v_shift.status <> 'open' then
    raise exception 'This till session is already closed' using errcode = '22023';
  end if;
  if p_counted_cash is null then
    raise exception 'Count the cash in the drawer' using errcode = '22023';
  end if;

  update public.shifts set
    status = 'closed',
    closed_by = auth.uid(),
    closed_at = now(),
    counted_cash_kobo = p_counted_cash,
    counted_card_kobo = p_counted_card,
    counted_transfer_kobo = p_counted_transfer,
    expected_cash_kobo = (select expected_kobo from public.shift_expected(p_shift_id) where method = 'cash'),
    expected_card_kobo = (select expected_kobo from public.shift_expected(p_shift_id) where method = 'card'),
    expected_transfer_kobo = (select expected_kobo from public.shift_expected(p_shift_id) where method = 'transfer'),
    close_note = nullif(trim(p_note), '')
  where id = p_shift_id;
end;
$$;

-- ---------- Sales ----------

-- payload: {
--   location_id, note?,
--   customer?: { name, phone?, email?, address? },
--   lines: [{ sku_id, batch?, quantity }],
--   payments: [{ method, amount_kobo, tendered_kobo?, reference? }],
--   fulfilment?: 'taken' | 'collect_later' | 'delivery',
--   delivery?: { address, area?, date?, fee_kobo? }
-- }
-- Prices come from the catalogue, never from the client. Payments must add up to the total exactly.
create function public.create_sale(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location uuid := (payload ->> 'location_id')::uuid;
  v_shift uuid;
  v_sale uuid;
  v_number text;
  v_customer uuid;
  v_phone text;
  v_line jsonb;
  v_payment jsonb;
  v_sku record;
  v_qty numeric;
  v_batch text;
  v_line_total bigint;
  v_subtotal bigint := 0;
  v_fee bigint := 0;
  v_total bigint;
  v_paid bigint := 0;
  v_fulfilment public.fulfilment := coalesce((payload ->> 'fulfilment')::public.fulfilment, 'taken');
  v_settings public.business_settings;
  v_order int := 0;
begin
  perform public.assert_can_sell_at(v_location);

  select id into v_shift from public.shifts where location_id = v_location and status = 'open';
  if v_shift is null then
    raise exception 'Open the till before making sales' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(payload -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'The cart is empty' using errcode = '22023';
  end if;

  -- Customer: found by phone if given, otherwise created. Required for collection and delivery.
  if payload -> 'customer' is not null and nullif(trim(payload -> 'customer' ->> 'name'), '') is not null then
    v_phone := public.normalize_phone(payload -> 'customer' ->> 'phone');
    if v_phone is not null then
      select id into v_customer from public.customers where phone = v_phone;
    end if;
    if v_customer is null then
      insert into public.customers (name, phone, email, address)
      values (
        trim(payload -> 'customer' ->> 'name'),
        v_phone,
        nullif(trim(payload -> 'customer' ->> 'email'), ''),
        nullif(trim(payload -> 'customer' ->> 'address'), '')
      )
      returning id into v_customer;
    else
      update public.customers set
        name = trim(payload -> 'customer' ->> 'name'),
        email = coalesce(nullif(trim(payload -> 'customer' ->> 'email'), ''), email),
        address = coalesce(nullif(trim(payload -> 'customer' ->> 'address'), ''), address)
      where id = v_customer;
    end if;
  end if;
  if v_fulfilment <> 'taken' and (v_customer is null or v_phone is null) then
    raise exception 'Customer name and phone are needed for collection or delivery' using errcode = '22023';
  end if;
  if v_fulfilment = 'delivery' then
    if nullif(trim(payload -> 'delivery' ->> 'address'), '') is null then
      raise exception 'Enter the delivery address' using errcode = '22023';
    end if;
    v_fee := coalesce((payload -> 'delivery' ->> 'fee_kobo')::bigint, 0);
    if v_fee < 0 then
      raise exception 'Delivery fee cannot be negative' using errcode = '22023';
    end if;
  end if;

  select * into v_settings from public.business_settings where id = 1;

  insert into public.sales (
    location_id, shift_id, customer_id, cashier_id, subtotal_kobo, delivery_fee_kobo, total_kobo,
    fulfilment, fulfilment_status, delivery_address, delivery_area, delivery_date, note
  ) values (
    v_location, v_shift, v_customer, auth.uid(), 0, v_fee, 0,
    v_fulfilment,
    case when v_fulfilment = 'taken' then 'completed' else 'pending' end::public.fulfilment_status,
    case when v_fulfilment = 'delivery' then trim(payload -> 'delivery' ->> 'address') end,
    case when v_fulfilment = 'delivery' then nullif(trim(payload -> 'delivery' ->> 'area'), '') end,
    case when v_fulfilment = 'delivery' then nullif(payload -> 'delivery' ->> 'date', '')::date end,
    nullif(trim(payload ->> 'note'), '')
  )
  returning id, number into v_sale, v_number;

  for v_line in select * from jsonb_array_elements(payload -> 'lines') loop
    v_qty := (v_line ->> 'quantity')::numeric;
    v_batch := coalesce(trim(v_line ->> 'batch'), '');
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantities must be above zero' using errcode = '22023';
    end if;

    select s.id, s.code, s.price_kobo, s.promo_price_kobo, s.is_active, p.is_active as product_active, p.track_batches
    into v_sku
    from public.skus s join public.products p on p.id = s.product_id
    where s.id = (v_line ->> 'sku_id')::uuid;
    if v_sku.id is null or not v_sku.is_active or not v_sku.product_active then
      raise exception 'An item in the cart is no longer for sale' using errcode = '22023';
    end if;
    if not v_sku.track_batches and v_batch <> '' then
      raise exception '% does not track batches', v_sku.code using errcode = '22023';
    end if;

    v_line_total := round(coalesce(v_sku.promo_price_kobo, v_sku.price_kobo) * v_qty);
    v_subtotal := v_subtotal + v_line_total;
    v_order := v_order + 1;

    insert into public.sale_lines (
      sale_id, sku_id, batch, quantity, list_price_kobo, unit_price_kobo, line_total_kobo, sort_order
    ) values (
      v_sale, v_sku.id, v_batch, v_qty, v_sku.price_kobo, coalesce(v_sku.promo_price_kobo, v_sku.price_kobo),
      v_line_total, v_order
    );

    -- Stock leaves the shop now, even for later collection/delivery, so it can't be sold twice.
    perform public.apply_stock_movement(v_sku.id, v_location, v_batch, -v_qty, 'sale', 'sale', v_sale, v_number);
  end loop;

  v_total := v_subtotal + v_fee;

  for v_payment in select * from jsonb_array_elements(coalesce(payload -> 'payments', '[]'::jsonb)) loop
    if (v_payment ->> 'amount_kobo')::bigint <= 0 then
      continue;
    end if;
    insert into public.sale_payments (sale_id, method, amount_kobo, tendered_kobo, reference)
    values (
      v_sale,
      (v_payment ->> 'method')::public.payment_method,
      (v_payment ->> 'amount_kobo')::bigint,
      case when v_payment ->> 'method' = 'cash' then (v_payment ->> 'tendered_kobo')::bigint end,
      nullif(trim(v_payment ->> 'reference'), '')
    );
    v_paid := v_paid + (v_payment ->> 'amount_kobo')::bigint;
  end loop;

  if v_paid <> v_total then
    raise exception 'Payments (%) must equal the total (%)',
      to_char(v_paid / 100.0, 'FM999,999,999,990.00'), to_char(v_total / 100.0, 'FM999,999,999,990.00')
      using errcode = '22023';
  end if;

  update public.sales set
    subtotal_kobo = v_subtotal,
    total_kobo = v_total,
    vat_rate = case when v_settings.vat_enabled then v_settings.vat_rate end,
    vat_kobo = case when v_settings.vat_enabled
      then round(v_total * v_settings.vat_rate / (100 + v_settings.vat_rate)) else 0 end
  where id = v_sale;

  return v_sale;
end;
$$;

create function public.update_fulfilment(p_sale_id uuid, p_status public.fulfilment_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;
  perform public.assert_can_sell_at(v_sale.location_id);
  if v_sale.fulfilment = 'taken' then
    raise exception 'The customer took these items at the time of sale' using errcode = '22023';
  end if;
  if p_status = 'out_for_delivery' and v_sale.fulfilment <> 'delivery' then
    raise exception 'Only deliveries can be out for delivery' using errcode = '22023';
  end if;
  update public.sales
  set fulfilment_status = p_status, fulfilment_updated_at = now(), fulfilment_updated_by = auth.uid()
  where id = p_sale_id;
end;
$$;

-- ---------- Returns ----------

-- payload: { sale_id, refund_method, reason, lines: [{ sale_line_id, quantity, condition }] }
-- Returned at the shop that made the sale, into the till that is open now. The refund is the price
-- the customer paid for those items. Damaged returns are written off straight away.
create function public.create_return(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
  v_shift uuid;
  v_return uuid;
  v_number text;
  v_line jsonb;
  v_sale_line public.sale_lines;
  v_qty numeric;
  v_condition public.return_condition;
  v_refund bigint;
  v_total bigint := 0;
begin
  select * into v_sale from public.sales where id = (payload ->> 'sale_id')::uuid for update;
  if v_sale.id is null then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;
  perform public.assert_can_sell_at(v_sale.location_id);
  select id into v_shift from public.shifts where location_id = v_sale.location_id and status = 'open';
  if v_shift is null then
    raise exception 'Open the till before processing a return' using errcode = '22023';
  end if;
  if nullif(trim(payload ->> 'reason'), '') is null then
    raise exception 'Give a reason for the return' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(payload -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'Choose at least one item to return' using errcode = '22023';
  end if;

  insert into public.returns (sale_id, location_id, shift_id, refund_method, refund_kobo, reason, created_by)
  values (
    v_sale.id, v_sale.location_id, v_shift, (payload ->> 'refund_method')::public.payment_method, 0,
    trim(payload ->> 'reason'), auth.uid()
  )
  returning id, number into v_return, v_number;

  for v_line in select * from jsonb_array_elements(payload -> 'lines') loop
    v_qty := (v_line ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;
    select * into v_sale_line from public.sale_lines
    where id = (v_line ->> 'sale_line_id')::uuid and sale_id = v_sale.id for update;
    if v_sale_line.id is null then
      raise exception 'That item is not on this sale' using errcode = '22023';
    end if;
    if v_sale_line.returned_quantity + v_qty > v_sale_line.quantity then
      raise exception 'Cannot return more than was bought' using errcode = '22023';
    end if;
    v_condition := coalesce((v_line ->> 'condition')::public.return_condition, 'restock');
    v_refund := round(v_sale_line.unit_price_kobo * v_qty);
    v_total := v_total + v_refund;

    insert into public.return_lines (return_id, sale_line_id, quantity, condition, refund_kobo)
    values (v_return, v_sale_line.id, v_qty, v_condition, v_refund);
    update public.sale_lines set returned_quantity = returned_quantity + v_qty where id = v_sale_line.id;

    perform public.apply_stock_movement(
      v_sale_line.sku_id, v_sale.location_id, v_sale_line.batch, v_qty, 'return', 'return', v_return,
      v_number || ' · ' || v_sale.number
    );
    if v_condition = 'damaged' then
      perform public.apply_stock_movement(
        v_sale_line.sku_id, v_sale.location_id, v_sale_line.batch, -v_qty, 'damage', 'return', v_return,
        v_number || ' · returned damaged'
      );
    end if;
  end loop;

  if v_total = 0 then
    raise exception 'Choose at least one item to return' using errcode = '22023';
  end if;
  update public.returns set refund_kobo = v_total where id = v_return;
  return v_return;
end;
$$;

-- ---------- Row-level security ----------

alter table public.customers enable row level security;
alter table public.shifts enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.sale_payments enable row level security;
alter table public.returns enable row level security;
alter table public.return_lines enable row level security;

create policy "Till staff read customers" on public.customers for select to authenticated
  using (public.current_staff_role() in ('owner', 'manager', 'cashier'));

create policy "Staff read shifts at their shop" on public.shifts for select to authenticated
  using (public.is_manager_or_owner() or location_id = public.current_staff_location());
create policy "Staff read sales at their shop" on public.sales for select to authenticated
  using (public.is_manager_or_owner() or location_id = public.current_staff_location());
create policy "Staff read sale lines" on public.sale_lines for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));
create policy "Staff read sale payments" on public.sale_payments for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));
create policy "Staff read returns at their shop" on public.returns for select to authenticated
  using (public.is_manager_or_owner() or location_id = public.current_staff_location());
create policy "Staff read return lines" on public.return_lines for select to authenticated
  using (exists (select 1 from public.returns r where r.id = return_id));

revoke all on public.customers, public.shifts, public.sales, public.sale_lines, public.sale_payments,
  public.returns, public.return_lines from anon;
revoke insert, update, delete, truncate on public.customers, public.shifts, public.sales, public.sale_lines,
  public.sale_payments, public.returns, public.return_lines from authenticated;

revoke execute on function
  public.open_shift(uuid, bigint), public.close_shift(uuid, bigint, bigint, bigint, text),
  public.shift_expected(uuid), public.create_sale(jsonb), public.update_fulfilment(uuid, public.fulfilment_status),
  public.create_return(jsonb)
  from public, anon;
grant execute on function
  public.open_shift(uuid, bigint), public.close_shift(uuid, bigint, bigint, bigint, text),
  public.shift_expected(uuid), public.create_sale(jsonb), public.update_fulfilment(uuid, public.fulfilment_status),
  public.create_return(jsonb)
  to authenticated;
