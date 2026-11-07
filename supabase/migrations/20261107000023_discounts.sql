-- Discounts at the till, with a limit per person. Modasa sometimes gives discounts, but they need control:
--
-- - Each staff member has a discount limit, a percentage of the items' value. The owner sets anyone's;
--   managers set cashiers'. The owner is unlimited. There is no approval step: a discount above the limit is
--   refused.
-- - A discount is one per sale, on the items (not the delivery fee), as a percentage or an amount, and needs
--   a reason. Below cost is refused unless the owner gives it.
-- - It is spread over the sale's lines in proportion, so an exchange later credits what was actually paid.
-- - Every discount is in the security log and in the Staff report. Exchanges can't carry a discount, so the
--   equal-value rule can't be got round.

alter table public.profiles
  add column discount_limit_pct numeric(5, 2) not null default 0 check (discount_limit_pct between 0 and 100);

alter table public.sales
  add column discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  add column discount_reason text;

-- The largest discount someone may give, as a percentage. The owner: no limit.
create function public.discount_limit(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when role = 'owner' then 100 else discount_limit_pct end
  from public.profiles where id = p_user and is_active
$$;

-- The owner sets anyone's limit; a manager sets cashiers'. Logged in the security log.
create function public.set_discount_limit(p_user uuid, p_pct numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
  v_role public.staff_role := public.current_staff_role();
begin
  select * into v_target from public.profiles where id = p_user for update;
  if v_target.id is null then
    raise exception 'Staff member not found' using errcode = 'P0002';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'Enter a percentage from 0 to 100' using errcode = '22023';
  end if;
  if not (v_role = 'owner' or (v_role = 'manager' and v_target.role = 'cashier')) then
    raise exception 'Managers can set cashiers'' limits; the owner sets everyone''s' using errcode = '42501';
  end if;
  if v_target.role = 'owner' then
    raise exception 'The owner has no discount limit' using errcode = '22023';
  end if;
  if v_target.discount_limit_pct = p_pct then return; end if;
  update public.profiles set discount_limit_pct = p_pct where id = p_user;
  perform public.security_log_write(auth.uid(), 'money', 'discount_limit',
    format('changed %s''s discount limit from %s%% to %s%%', v_target.full_name,
      public.security_log_qty(v_target.discount_limit_pct), public.security_log_qty(p_pct)));
end;
$$;

revoke execute on function public.discount_limit(uuid), public.set_discount_limit(uuid, numeric) from public, anon;
grant execute on function public.discount_limit(uuid), public.set_discount_limit(uuid, numeric) to authenticated;

-- ---------- Sales take a discount ----------

-- payload as before, plus discount?: { type: 'percent' | 'amount', value, reason }. 'amount' is in kobo.
create or replace function public.create_sale(payload jsonb)
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
  v_discount_in jsonb := payload -> 'discount';
  v_discount bigint := 0;
  v_reason text;
  v_limit numeric;
  v_cost bigint;
  v_allocated bigint := 0;
  v_lines int;
  v_n int := 0;
  v_dl record;
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

  -- Discount on the items (not the delivery fee): a percentage or an amount, with a reason, up to the
  -- seller's own limit, and never below cost unless the owner gives it.
  if v_discount_in is not null and coalesce((v_discount_in ->> 'value')::numeric, 0) > 0 then
    v_reason := nullif(trim(v_discount_in ->> 'reason'), '');
    if v_reason is null then
      raise exception 'Give a reason for the discount' using errcode = '22023';
    end if;
    v_discount := case v_discount_in ->> 'type'
      when 'percent' then round(v_subtotal * (v_discount_in ->> 'value')::numeric / 100)
      when 'amount' then round((v_discount_in ->> 'value')::numeric)
    end;
    if v_discount is null or v_discount <= 0 or v_discount > v_subtotal then
      raise exception 'Check the discount' using errcode = '22023';
    end if;
    v_limit := public.discount_limit(auth.uid());
    if v_discount > round(v_subtotal * v_limit / 100) then
      raise exception 'That discount is more than your limit of %', public.security_log_qty(v_limit) || '%' using errcode = '22023';
    end if;
    if public.current_staff_role() <> 'owner' then
      select sum(round(c.cost_kobo * l.quantity)) into v_cost
      from public.sale_lines l join public.sku_costs c on c.sku_id = l.sku_id
      where l.sale_id = v_sale;
      if v_cost is not null and v_subtotal - v_discount < v_cost then
        raise exception 'That discount is too large for these items. Ask the owner.' using errcode = '22023';
      end if;
    end if;

    -- Spread it over the lines in proportion, so an exchange later credits what was actually paid.
    select count(*) into v_lines from public.sale_lines where sale_id = v_sale;
    for v_dl in select id, quantity, line_total_kobo from public.sale_lines where sale_id = v_sale order by sort_order loop
      v_n := v_n + 1;
      declare
        v_share bigint := case when v_n = v_lines then v_discount - v_allocated
          else floor(v_discount::numeric * v_dl.line_total_kobo / nullif(v_subtotal, 0)) end;
      begin
        v_allocated := v_allocated + v_share;
        update public.sale_lines set
          line_total_kobo = line_total_kobo - v_share,
          unit_price_kobo = round((line_total_kobo - v_share) / quantity)
        where id = v_dl.id;
      end;
    end loop;
    v_subtotal := v_subtotal - v_discount;
  end if;

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
    discount_kobo = v_discount,
    discount_reason = v_reason,
    vat_rate = case when v_settings.vat_enabled then v_settings.vat_rate end,
    vat_kobo = case when v_settings.vat_enabled
      then round(v_total * v_settings.vat_rate / (100 + v_settings.vat_rate)) else 0 end
  where id = v_sale;

  return v_sale;
end;
$$;

-- ---------- No discounts on exchanges ----------

create or replace function public.create_exchange_no_discount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.discount_kobo > 0 and coalesce(current_setting('modasa.exchange_return', true), '') <> '' then
    raise exception 'No discount on an exchange: the replacement is at its full price' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger sales_no_discount_on_exchange before update of discount_kobo on public.sales
  for each row execute function public.create_exchange_no_discount();

revoke execute on function public.create_exchange_no_discount() from public, anon, authenticated;

-- ---------- Security log ----------

create function public.security_log_discounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or new.discount_kobo = 0 or old.discount_kobo = new.discount_kobo then return null; end if;
  perform public.security_log_write(auth.uid(), 'money', 'discount',
    format('gave a %s discount on %s (%s of %s): %s', public.security_log_money(new.discount_kobo), new.number,
      public.security_log_qty(round(new.discount_kobo * 100.0 / nullif(new.subtotal_kobo + new.discount_kobo, 0), 1)) || '%',
      public.security_log_money(new.subtotal_kobo + new.discount_kobo), new.discount_reason),
    new.location_id, 'sale', new.id);
  return null;
end;
$$;

create trigger security_log_discount after update of discount_kobo on public.sales
  for each row execute function public.security_log_discounts();

revoke execute on function public.security_log_discounts() from public, anon, authenticated;

-- ---------- Staff report: discounts per person ----------

drop function public.report_staff(date, date, uuid);
create function public.report_staff(p_from date, p_to date, p_location uuid default null)
returns table (
  staff_id uuid,
  sales_count bigint,
  sales_kobo bigint,
  returns_count bigint,
  returns_kobo bigint,
  drawer_openings bigint,
  sessions_closed bigint,
  cash_difference_kobo bigint,
  discounts_count bigint,
  discounts_kobo bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with s as (
    select cashier_id as id, count(*) as n, sum(total_kobo) as amount,
      count(*) filter (where discount_kobo > 0) as dn, sum(discount_kobo) as damount
    from public.sales
    where public.business_date(created_at) between p_from and p_to and (p_location is null or location_id = p_location)
    group by 1
  ),
  r as (
    select created_by as id, count(*) as n, sum(refund_kobo) as amount from public.returns
    where public.business_date(created_at) between p_from and p_to and (p_location is null or location_id = p_location)
    group by 1
  ),
  d as (
    select opened_by as id, count(*) as n from public.drawer_openings
    where public.business_date(created_at) between p_from and p_to and (p_location is null or location_id = p_location)
    group by 1
  ),
  c as (
    select closed_by as id, count(*) as n, sum(counted_cash_kobo - expected_cash_kobo) as diff from public.shifts
    where status = 'closed' and public.business_date(closed_at) between p_from and p_to
      and (p_location is null or location_id = p_location)
    group by 1
  ),
  ids as (select id from s union select id from r union select id from d union select id from c)
  select
    ids.id,
    coalesce(s.n, 0), coalesce(s.amount, 0)::bigint,
    coalesce(r.n, 0), coalesce(r.amount, 0)::bigint,
    coalesce(d.n, 0),
    coalesce(c.n, 0), coalesce(c.diff, 0)::bigint,
    coalesce(s.dn, 0), coalesce(s.damount, 0)::bigint
  from ids
  left join s on s.id = ids.id
  left join r on r.id = ids.id
  left join d on d.id = ids.id
  left join c on c.id = ids.id
  where ids.id is not null
$$;

revoke execute on function public.report_staff(date, date, uuid) from public, anon;
grant execute on function public.report_staff(date, date, uuid) to authenticated;
