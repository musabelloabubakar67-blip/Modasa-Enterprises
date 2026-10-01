-- Online shop: which products are shown, delivery areas, online orders paid through the payment
-- provider, and short stock holds while a customer pays.
--
-- The public website never talks to the database directly. Its server code uses the service role
-- with explicit field lists, so nothing here is granted to anonymous visitors.

create extension if not exists unaccent with schema extensions;

-- ---------- Products on the website ----------

alter table public.products
  add column show_online boolean not null default false,
  add column is_featured boolean not null default false,
  add column slug text;

create function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(p_text)), '[^a-z0-9]+', '-', 'g'))
$$;

-- Readable, unique web address for each product, e.g. /p/centre-rug-turkey. Kept stable once set.
create function public.set_product_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_n int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;
  v_base := coalesce(nullif(public.slugify(new.name), ''), 'item');
  v_slug := v_base;
  while exists (select 1 from public.products where slug = v_slug and id <> new.id) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  new.slug := v_slug;
  return new;
end;
$$;

create trigger products_slug before insert or update of slug on public.products
  for each row execute function public.set_product_slug();

update public.products set slug = null;
create unique index products_slug_key on public.products (slug);

-- ---------- Website settings and delivery areas ----------

alter table public.business_settings
  add column storefront_enabled boolean not null default true,
  add column tagline text,
  add column whatsapp_number text,
  add column opening_hours text,
  -- How long stock is held for a customer while they pay.
  add column order_hold_minutes int not null default 20 check (order_hold_minutes between 5 and 120);

create table public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee_kobo bigint not null check (fee_kobo >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0
);

create unique index delivery_areas_name_key on public.delivery_areas (lower(name));

alter table public.delivery_areas enable row level security;
create policy "Staff read delivery areas" on public.delivery_areas for select to authenticated
  using (public.current_staff_role() is not null);
create policy "Managers add delivery areas" on public.delivery_areas for insert to authenticated
  with check (public.is_manager_or_owner());
create policy "Managers edit delivery areas" on public.delivery_areas for update to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());
revoke all on public.delivery_areas from anon;

-- ---------- Online sales don't belong to a till session ----------

alter table public.sales alter column shift_id drop not null;
alter table public.sales add column channel text not null default 'till' check (channel in ('till', 'online'));
alter table public.sales add constraint till_sales_need_a_session check (channel = 'online' or shift_id is not null);

-- ---------- Online orders ----------

create type public.online_order_status as enum (
  'pending_payment', -- created at checkout; stock is held until expires_at
  'paid',            -- payment confirmed; about to be turned into a sale
  'awaiting_stock',  -- paid, but some items must come from a warehouse first (or need attention)
  'confirmed',       -- a sale exists; handover is tracked on the sale
  'expired',         -- never paid
  'cancelled',
  'refunded'
);

create sequence public.online_order_number_seq;

create table public.online_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default 'WEB-' || lpad(nextval('public.online_order_number_seq')::text, 6, '0'),
  -- Unguessable token for the customer's order-status link.
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  status public.online_order_status not null default 'pending_payment',
  -- The shop that hands the order over (pickup shop, or the shop delivering it).
  location_id uuid not null references public.locations (id),
  fulfilment public.fulfilment not null check (fulfilment <> 'taken'),
  customer_name text not null,
  customer_phone text not null check (customer_phone ~ '^[0-9]{7,15}$'),
  customer_email text,
  delivery_address text,
  delivery_area text,
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  subtotal_kobo bigint not null,
  total_kobo bigint not null,
  note text,
  payment_reference text not null unique,
  paid_at timestamptz,
  paid_amount_kobo bigint,
  sale_id uuid references public.sales (id),
  transfer_requested boolean not null default false,
  -- Set when staff need to step in, e.g. an item sold out at the shop while the customer was paying.
  attention text,
  expires_at timestamptz not null,
  cancelled_reason text,
  refunded_at timestamptz,
  refund_note text,
  created_at timestamptz not null default now(),
  constraint delivery_needs_address check (fulfilment <> 'delivery' or delivery_address is not null)
);

create index online_orders_status_idx on public.online_orders (status, created_at desc);
create index online_orders_location_idx on public.online_orders (location_id, created_at desc);

create table public.online_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.online_orders (id) on delete cascade,
  sku_id uuid not null references public.skus (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  list_price_kobo bigint not null,
  unit_price_kobo bigint not null,
  line_total_kobo bigint not null,
  sort_order int not null default 0
);

create index online_order_lines_order_idx on public.online_order_lines (order_id);

-- Stock set aside for an unpaid (or paid-but-waiting) online order, at the location that has it.
create table public.stock_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.online_orders (id) on delete cascade,
  sku_id uuid not null references public.skus (id),
  location_id uuid not null references public.locations (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  expires_at timestamptz not null
);

create index stock_holds_sku_idx on public.stock_holds (sku_id, location_id);

-- ---------- Availability for the website ----------

-- Stock minus live holds, per location. Called only by the website's server code.
create function public.online_availability(p_sku_ids uuid[])
returns table (sku_id uuid, location_id uuid, kind public.location_kind, available numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select ls.sku_id, ls.location_id, l.kind,
    ls.quantity - coalesce((
      select sum(h.quantity) from public.stock_holds h
      where h.sku_id = ls.sku_id and h.location_id = ls.location_id and h.expires_at > now()
    ), 0)
  from public.sku_location_stock ls
  join public.locations l on l.id = ls.location_id and l.is_active
  where ls.sku_id = any (p_sku_ids)
$$;

-- ---------- Checkout: create the order and hold the stock ----------

-- payload: { location_id, fulfilment, customer: { name, phone, email? }, note?,
--            delivery?: { address, area_id }, lines: [{ sku_id, quantity }] }
-- Prices come from the catalogue. Each line is held at the shop if it has it, otherwise at a
-- warehouse (the customer is told it takes a little longer).
create function public.create_online_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location uuid := (payload ->> 'location_id')::uuid;
  v_fulfilment public.fulfilment := (payload ->> 'fulfilment')::public.fulfilment;
  v_phone text := public.normalize_phone(payload -> 'customer' ->> 'phone');
  v_settings public.business_settings;
  v_order public.online_orders;
  v_expires timestamptz;
  v_area public.delivery_areas;
  v_fee bigint := 0;
  v_subtotal bigint := 0;
  v_line jsonb;
  v_sku record;
  v_qty numeric;
  v_hold_at uuid;
  v_order_n int := 0;
  v_needs_transfer boolean := false;
begin
  select * into v_settings from public.business_settings where id = 1;
  if not v_settings.storefront_enabled then
    raise exception 'The online shop is closed at the moment' using errcode = '22023';
  end if;
  if not exists (select 1 from public.locations where id = v_location and kind = 'shop' and is_active) then
    raise exception 'Choose a shop' using errcode = '22023';
  end if;
  if v_fulfilment = 'taken' then
    raise exception 'Choose pickup or delivery' using errcode = '22023';
  end if;
  if nullif(trim(payload -> 'customer' ->> 'name'), '') is null or v_phone is null or length(v_phone) < 7 then
    raise exception 'Enter your name and phone number' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(payload -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'Your cart is empty' using errcode = '22023';
  end if;
  if v_fulfilment = 'delivery' then
    if nullif(trim(payload -> 'delivery' ->> 'address'), '') is null then
      raise exception 'Enter the delivery address' using errcode = '22023';
    end if;
    select * into v_area from public.delivery_areas
    where id = nullif(payload -> 'delivery' ->> 'area_id', '')::uuid and is_active;
    if v_area.id is null then
      raise exception 'Choose a delivery area' using errcode = '22023';
    end if;
    v_fee := v_area.fee_kobo;
  end if;

  v_expires := now() + make_interval(mins => v_settings.order_hold_minutes);

  insert into public.online_orders (
    location_id, fulfilment, customer_name, customer_phone, customer_email, delivery_address, delivery_area,
    delivery_fee_kobo, subtotal_kobo, total_kobo, note, payment_reference, expires_at
  ) values (
    v_location, v_fulfilment, trim(payload -> 'customer' ->> 'name'), v_phone,
    nullif(trim(payload -> 'customer' ->> 'email'), ''),
    case when v_fulfilment = 'delivery' then trim(payload -> 'delivery' ->> 'address') end,
    case when v_fulfilment = 'delivery' then v_area.name end,
    v_fee, 0, 0, nullif(trim(payload ->> 'note'), ''),
    'ORD-' || encode(extensions.gen_random_bytes(10), 'hex'), v_expires
  )
  returning * into v_order;

  for v_line in select * from jsonb_array_elements(payload -> 'lines') loop
    v_qty := (v_line ->> 'quantity')::numeric;
    select s.id, s.code, s.price_kobo, s.promo_price_kobo, p.name, u.allows_decimal
    into v_sku
    from public.skus s
    join public.products p on p.id = s.product_id
    join public.units u on u.id = p.unit_id
    where s.id = (v_line ->> 'sku_id')::uuid and s.is_active and p.is_active and p.show_online;
    if v_sku.id is null then
      raise exception 'An item in your cart is no longer available' using errcode = '22023';
    end if;
    if v_qty is null or v_qty <= 0 or (not v_sku.allows_decimal and v_qty <> trunc(v_qty)) then
      raise exception 'Check the quantity for %', v_sku.name using errcode = '22023';
    end if;

    -- Hold at the shop if it has enough; otherwise at the warehouse with the most.
    select a.location_id into v_hold_at
    from public.online_availability(array[v_sku.id]) a
    where a.available >= v_qty and (a.location_id = v_location or a.kind = 'warehouse')
    order by (a.location_id = v_location) desc, a.available desc
    limit 1;
    if v_hold_at is null then
      raise exception '% is no longer available in that quantity', v_sku.name using errcode = '22023';
    end if;
    if v_hold_at <> v_location then
      v_needs_transfer := true;
    end if;

    insert into public.stock_holds (order_id, sku_id, location_id, quantity, expires_at)
    values (v_order.id, v_sku.id, v_hold_at, v_qty, v_expires);

    v_order_n := v_order_n + 1;
    insert into public.online_order_lines (
      order_id, sku_id, quantity, list_price_kobo, unit_price_kobo, line_total_kobo, sort_order
    ) values (
      v_order.id, v_sku.id, v_qty, v_sku.price_kobo, coalesce(v_sku.promo_price_kobo, v_sku.price_kobo),
      round(coalesce(v_sku.promo_price_kobo, v_sku.price_kobo) * v_qty), v_order_n
    );
    v_subtotal := v_subtotal + round(coalesce(v_sku.promo_price_kobo, v_sku.price_kobo) * v_qty);
  end loop;

  update public.online_orders set subtotal_kobo = v_subtotal, total_kobo = v_subtotal + v_fee where id = v_order.id;

  return jsonb_build_object(
    'id', v_order.id, 'number', v_order.number, 'token', v_order.token, 'reference', v_order.payment_reference,
    'total_kobo', v_subtotal + v_fee, 'expires_at', v_expires, 'needs_transfer', v_needs_transfer
  );
end;
$$;

-- ---------- Turning a paid order into a sale ----------

-- Creates the sale at the fulfilling shop if every item is there. Otherwise asks a warehouse for
-- the missing items (once) and leaves the order waiting, with the stock still held.
create function public.fulfil_online_order(p_order_id uuid)
returns public.online_order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.online_orders;
  v_settings public.business_settings;
  v_line record;
  v_missing record;
  v_have numeric;
  v_short boolean := false;
  v_unavailable text;
  v_customer uuid;
  v_sale uuid;
  v_sale_number text;
  v_batch record;
  v_left numeric;
  v_take numeric;
  v_n int := 0;
  v_transfer uuid;
  v_source uuid;
  v_shop_name text;
begin
  select * into v_order from public.online_orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('paid', 'awaiting_stock') then
    return v_order.status;
  end if;
  select name into v_shop_name from public.locations where id = v_order.location_id;

  -- Is everything at the shop right now?
  for v_line in select l.*, s.code from public.online_order_lines l join public.skus s on s.id = l.sku_id
                where l.order_id = p_order_id loop
    select coalesce(sum(quantity), 0) into v_have from public.stock_levels
    where sku_id = v_line.sku_id and location_id = v_order.location_id and quantity > 0;
    if v_have < v_line.quantity then
      v_short := true;
    end if;
  end loop;

  if v_short then
    if not v_order.transfer_requested then
      -- One transfer request per warehouse that is holding stock for this order.
      for v_source in
        select distinct h.location_id from public.stock_holds h
        where h.order_id = p_order_id and h.location_id <> v_order.location_id
      loop
        insert into public.transfers (from_location_id, to_location_id, note)
        values (v_source, v_order.location_id, 'Online order ' || v_order.number || ' (paid) — customer is waiting')
        returning id into v_transfer;
        insert into public.transfer_lines (transfer_id, sku_id, requested_quantity, sort_order)
        select v_transfer, h.sku_id, sum(h.quantity), row_number() over ()
        from public.stock_holds h where h.order_id = p_order_id and h.location_id = v_source
        group by h.sku_id;
      end loop;
    end if;

    -- Anything short at the shop that no warehouse is holding needs a person to sort out.
    select string_agg(s.code, ', ') into v_unavailable
    from public.online_order_lines l join public.skus s on s.id = l.sku_id
    where l.order_id = p_order_id
      and (select coalesce(sum(quantity), 0) from public.stock_levels
           where sku_id = l.sku_id and location_id = v_order.location_id and quantity > 0) < l.quantity
      and not exists (select 1 from public.stock_holds h
                      where h.order_id = p_order_id and h.sku_id = l.sku_id and h.location_id <> v_order.location_id);

    update public.online_orders set
      status = 'awaiting_stock',
      transfer_requested = true,
      attention = case
        when v_unavailable is not null
          then 'Sold out at ' || v_shop_name || ' while the customer was paying: ' || v_unavailable || '. Arrange stock or refund.'
        else 'Waiting for stock from the warehouse. Create the sale once it arrives.'
      end
    where id = p_order_id;
    -- Keep the stock reserved while the order waits.
    update public.stock_holds set expires_at = 'infinity' where order_id = p_order_id;
    return 'awaiting_stock';
  end if;

  -- Everything is here: record the sale.
  select id into v_customer from public.customers where phone = v_order.customer_phone;
  if v_customer is null then
    insert into public.customers (name, phone, email, address)
    values (v_order.customer_name, v_order.customer_phone, v_order.customer_email, v_order.delivery_address)
    returning id into v_customer;
  end if;
  select * into v_settings from public.business_settings where id = 1;

  insert into public.sales (
    location_id, shift_id, channel, customer_id, subtotal_kobo, delivery_fee_kobo, total_kobo, vat_rate, vat_kobo,
    fulfilment, fulfilment_status, delivery_address, delivery_area, note
  ) values (
    v_order.location_id, null, 'online', v_customer, v_order.subtotal_kobo, v_order.delivery_fee_kobo,
    v_order.total_kobo,
    case when v_settings.vat_enabled then v_settings.vat_rate end,
    case when v_settings.vat_enabled
      then round(v_order.total_kobo * v_settings.vat_rate / (100 + v_settings.vat_rate)) else 0 end,
    v_order.fulfilment, 'pending', v_order.delivery_address, v_order.delivery_area,
    concat_ws(' · ', 'Online order ' || v_order.number, v_order.note)
  )
  returning id, number into v_sale, v_sale_number;

  for v_line in select * from public.online_order_lines where order_id = p_order_id order by sort_order loop
    -- Take from one batch if it covers the quantity (so shades match), otherwise from the largest.
    v_left := v_line.quantity;
    for v_batch in
      select batch, quantity from public.stock_levels
      where sku_id = v_line.sku_id and location_id = v_order.location_id and quantity > 0
      order by (quantity >= v_line.quantity) desc,
               case when quantity >= v_line.quantity then quantity end asc,
               quantity desc
    loop
      exit when v_left <= 0;
      v_take := least(v_left, v_batch.quantity);
      v_n := v_n + 1;
      insert into public.sale_lines (
        sale_id, sku_id, batch, quantity, list_price_kobo, unit_price_kobo, line_total_kobo, sort_order
      ) values (
        v_sale, v_line.sku_id, v_batch.batch, v_take, v_line.list_price_kobo, v_line.unit_price_kobo,
        round(v_line.unit_price_kobo * v_take), v_n
      );
      perform public.apply_stock_movement(
        v_line.sku_id, v_order.location_id, v_batch.batch, -v_take, 'sale', 'sale', v_sale, v_sale_number
      );
      v_left := v_left - v_take;
    end loop;
  end loop;

  insert into public.sale_payments (sale_id, method, amount_kobo, reference)
  values (v_sale, 'online', v_order.total_kobo, v_order.payment_reference);

  delete from public.stock_holds where order_id = p_order_id;
  update public.online_orders set status = 'confirmed', sale_id = v_sale, attention = null where id = p_order_id;
  return 'confirmed';
end;
$$;

-- Called when the payment provider confirms a payment. Safe to call more than once.
create function public.mark_order_paid(p_reference text, p_amount_kobo bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.online_orders;
  v_status public.online_order_status;
begin
  select * into v_order from public.online_orders where payment_reference = p_reference for update;
  if v_order.id is null then
    raise exception 'No order for payment %', p_reference using errcode = 'P0002';
  end if;
  if v_order.status not in ('pending_payment', 'expired') then
    return jsonb_build_object('token', v_order.token, 'status', v_order.status, 'already', true);
  end if;
  if p_amount_kobo < v_order.total_kobo then
    update public.online_orders
    set attention = 'A payment of ' || to_char(p_amount_kobo / 100.0, 'FM999,999,990.00') || ' arrived but the order total is '
                    || to_char(total_kobo / 100.0, 'FM999,999,990.00') || '. Check with the customer.'
    where id = v_order.id;
    raise exception 'Paid amount is less than the order total' using errcode = '22023';
  end if;

  update public.online_orders set status = 'paid', paid_at = now(), paid_amount_kobo = p_amount_kobo where id = v_order.id;
  v_status := public.fulfil_online_order(v_order.id);
  return jsonb_build_object('token', v_order.token, 'status', v_status, 'already', false);
end;
$$;

-- Releases stock held for orders that were never paid.
create function public.expire_online_orders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with expired as (
    update public.online_orders set status = 'expired'
    where status = 'pending_payment' and expires_at < now()
    returning id
  )
  delete from public.stock_holds h using expired e where h.order_id = e.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------- Staff actions ----------

create function public.assert_can_handle_order(p_order_id uuid)
returns public.online_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.online_orders;
begin
  select * into v_order from public.online_orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  perform public.assert_can_sell_at(v_order.location_id);
  return v_order;
end;
$$;

-- Staff retry after the warehouse stock has arrived.
create function public.retry_online_order(p_order_id uuid)
returns public.online_order_status
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can_handle_order(p_order_id);
  return public.fulfil_online_order(p_order_id);
end;
$$;

-- Managers cancel an order that hasn't become a sale. A paid order must then be refunded.
create function public.cancel_online_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.online_orders;
begin
  if not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can cancel online orders' using errcode = '42501';
  end if;
  select * into v_order from public.online_orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('pending_payment', 'paid', 'awaiting_stock') then
    raise exception 'This order can no longer be cancelled here' using errcode = '22023';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason' using errcode = '22023';
  end if;
  delete from public.stock_holds where order_id = p_order_id;
  update public.online_orders set
    status = 'cancelled',
    cancelled_reason = trim(p_reason),
    attention = case when paid_at is not null then 'Cancelled after payment: refund the customer.' end
  where id = p_order_id;
end;
$$;

create function public.mark_order_refunded(p_order_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can record refunds' using errcode = '42501';
  end if;
  update public.online_orders
  set status = 'refunded', refunded_at = now(), refund_note = nullif(trim(p_note), ''), attention = null
  where id = p_order_id and status = 'cancelled' and paid_at is not null;
  if not found then
    raise exception 'Only cancelled, paid orders can be marked refunded' using errcode = '22023';
  end if;
end;
$$;

-- ---------- Row-level security ----------

alter table public.online_orders enable row level security;
alter table public.online_order_lines enable row level security;
alter table public.stock_holds enable row level security;

create policy "Till staff read online orders for their shop" on public.online_orders for select to authenticated
  using (public.is_manager_or_owner()
         or (public.current_staff_role() = 'cashier' and location_id = public.current_staff_location()));
create policy "Till staff read online order lines" on public.online_order_lines for select to authenticated
  using (exists (select 1 from public.online_orders o where o.id = order_id));
create policy "Staff read stock holds" on public.stock_holds for select to authenticated
  using (public.current_staff_role() is not null);

revoke all on public.online_orders, public.online_order_lines, public.stock_holds from anon;
revoke insert, update, delete, truncate on public.online_orders, public.online_order_lines, public.stock_holds
  from authenticated;

-- Website-only functions: service role (server code) only.
revoke execute on function
  public.online_availability(uuid[]), public.create_online_order(jsonb), public.mark_order_paid(text, bigint),
  public.fulfil_online_order(uuid), public.expire_online_orders(), public.assert_can_handle_order(uuid)
  from public, anon, authenticated;
grant execute on function
  public.online_availability(uuid[]), public.create_online_order(jsonb), public.mark_order_paid(text, bigint),
  public.expire_online_orders()
  to service_role;

revoke execute on function
  public.retry_online_order(uuid), public.cancel_online_order(uuid, text), public.mark_order_refunded(uuid, text)
  from public, anon;
grant execute on function
  public.retry_online_order(uuid), public.cancel_online_order(uuid, text), public.mark_order_refunded(uuid, text)
  to authenticated;
