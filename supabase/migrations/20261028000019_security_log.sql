-- Security log: who did what on the staff site, in plain sentences, for the owner.
--
-- Only actions that matter for security are recorded (logins and staff, money, stock corrections,
-- settings); ordinary sales, deliveries and new products are not, so the log stays readable. Each line
-- is written once, as a sentence, with the person's and location's names as they were at the time.
--
-- Most lines are written by triggers on the tables below, so they are recorded however the change was
-- made. Actions done with the service key (creating a login, resetting a password, the training reset,
-- failed sign-ins) are logged by the app through security_log_add.
--
-- Nobody can edit or delete lines through the site, the owner included: there are no insert, update
-- or delete rights, and the owner can only read.

create table public.security_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  category text not null check (category in ('access', 'money', 'stock', 'settings')),
  action text not null,
  -- Who did it, and their name at the time. Null for failed sign-ins (nobody signed in).
  actor_id uuid,
  actor_name text,
  -- Where it happened, if anywhere. No foreign keys: the log outlives deleted locations and logins.
  location_id uuid,
  location_name text,
  -- The sentence shown, without the person's name, e.g. "refunded ₦15,000 cash on INV-000001".
  summary text not null,
  -- Extra lines shown on request, e.g. every price in a bulk change.
  details jsonb,
  -- The document it is about, for a link: sale, adjustment, transfer, online_order, shift.
  ref_kind text,
  ref_id uuid,
  -- Lines from one save are merged (e.g. ten prices changed in one product save are one line).
  txid bigint not null default txid_current()
);

create index security_log_at on public.security_log (at desc);
create index security_log_category_at on public.security_log (category, at desc);
create index security_log_actor_at on public.security_log (actor_id, at desc);

alter table public.security_log enable row level security;
create policy "Owner reads the security log" on public.security_log for select to authenticated
  using ((select public.is_owner()));
revoke all on public.security_log from anon;
revoke insert, update, delete, truncate on public.security_log from authenticated;

-- ---------- Formatting ----------

create function public.security_log_money(p_kobo bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_kobo is null then 'none' else
    '₦' || to_char(trunc(p_kobo / 100), 'FM999,999,999,990')
      || case when p_kobo % 100 <> 0 then '.' || lpad(abs(p_kobo % 100)::text, 2, '0') else '' end
  end
$$;

create function public.security_log_qty(p_qty numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_qty = trunc(p_qty) then trunc(p_qty)::text else rtrim(rtrim(p_qty::text, '0'), '.') end
$$;

create function public.security_log_sku(p_sku_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select p.name || coalesce(' · ' || s.variant_label, '')
  from public.skus s join public.products p on p.id = s.product_id
  where s.id = p_sku_id
$$;

create function public.security_log_person(p_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select full_name from public.profiles where id = p_id), 'someone')
$$;

create function public.security_log_place(p_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case when p_id is null then 'all locations'
    else coalesce((select name from public.locations where id = p_id), 'a deleted location') end
$$;

-- ---------- Writing ----------

create function public.security_log_write(
  p_actor uuid,
  p_category text,
  p_action text,
  p_summary text,
  p_location uuid default null,
  p_ref_kind text default null,
  p_ref_id uuid default null,
  p_details jsonb default null
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.security_log
    (actor_id, actor_name, category, action, summary, location_id, location_name, ref_kind, ref_id, details)
  values (
    p_actor,
    (select full_name from public.profiles where id = p_actor),
    p_category, p_action, p_summary,
    p_location,
    (select name from public.locations where id = p_location),
    p_ref_kind, p_ref_id, p_details
  )
  returning id
$$;

-- For the app, with the service key only: actions done outside the signed-in user's own rights.
create function public.security_log_add(
  p_actor uuid,
  p_category text,
  p_action text,
  p_summary text,
  p_location uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.security_log_write(p_actor, p_category, p_action, p_summary, p_location);
$$;

-- Failed sign-ins for one email within an hour are one line with a count, so guessing can't flood the log.
create function public.security_log_failed_sign_in(p_email text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_row public.security_log;
  v_count int;
begin
  select * into v_row from public.security_log
  where action = p_reason and details ->> 'email' = v_email and at > now() - interval '1 hour'
  order by at desc limit 1 for update;

  if v_row.id is null then
    insert into public.security_log (category, action, summary, details)
    values (
      'access', p_reason,
      case p_reason
        when 'deactivated_sign_in' then 'Deactivated login ' || v_email || ' tried to sign in'
        else 'Failed sign-in for ' || v_email
      end,
      jsonb_build_object('email', v_email, 'count', 1, 'last_at', now())
    );
  else
    v_count := coalesce((v_row.details ->> 'count')::int, 1) + 1;
    update public.security_log set
      summary = case p_reason
        when 'deactivated_sign_in' then 'Deactivated login ' || v_email || ' tried to sign in ' || v_count || ' times'
        else v_count || ' failed sign-ins for ' || v_email
      end,
      details = v_row.details || jsonb_build_object('count', v_count, 'last_at', now())
    where id = v_row.id;
  end if;
end;
$$;

revoke execute on function
  public.security_log_write(uuid, text, text, text, uuid, text, uuid, jsonb),
  public.security_log_add(uuid, text, text, text, uuid),
  public.security_log_failed_sign_in(text, text)
from public, anon, authenticated;
grant execute on function
  public.security_log_add(uuid, text, text, text, uuid),
  public.security_log_failed_sign_in(text, text)
to service_role;

-- ---------- Prices and costs ----------

-- One line per save: a product saved with five new prices, or a whole import, is one entry listing them.
create function public.security_log_price_change(p_sku_id uuid, p_change text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item text := public.security_log_sku(p_sku_id) || ': ' || p_change;
  v_row public.security_log;
  v_details jsonb;
  v_n int;
begin
  select * into v_row from public.security_log
  where txid = txid_current() and action = 'prices' and actor_id = auth.uid()
  for update;

  if v_row.id is null then
    perform public.security_log_write(auth.uid(), 'money', 'prices', 'changed ' || v_item,
      p_details => jsonb_build_array(v_item));
  else
    v_details := v_row.details || to_jsonb(v_item);
    v_n := jsonb_array_length(v_details);
    update public.security_log set
      details = v_details,
      summary = 'changed ' || v_n || ' prices: ' || (v_details ->> 0) || '; ' || (v_details ->> 1)
        || case when v_n > 2 then ' and ' || (v_n - 2) || ' more' else '' end
    where id = v_row.id;
  end if;
end;
$$;

create function public.security_log_skus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes text[] := '{}';
  m text;
begin
  if auth.uid() is null then return null; end if;
  if new.price_kobo is distinct from old.price_kobo then
    v_changes := v_changes || format('price %s → %s',
      public.security_log_money(old.price_kobo), public.security_log_money(new.price_kobo));
  end if;
  if new.promo_price_kobo is distinct from old.promo_price_kobo then
    m := case
      when new.promo_price_kobo is null then 'sale price ' || public.security_log_money(old.promo_price_kobo) || ' removed'
      when old.promo_price_kobo is null then 'sale price ' || public.security_log_money(new.promo_price_kobo) || ' added'
      else format('sale price %s → %s',
        public.security_log_money(old.promo_price_kobo), public.security_log_money(new.promo_price_kobo))
    end;
    v_changes := v_changes || m;
  end if;
  if cardinality(v_changes) > 0 then
    perform public.security_log_price_change(new.id, array_to_string(v_changes, ', '));
  end if;
  return null;
end;
$$;

create trigger security_log after update of price_kobo, promo_price_kobo on public.skus
  for each row execute function public.security_log_skus();

create function public.security_log_sku_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or new.cost_kobo is not distinct from old.cost_kobo then return null; end if;
  perform public.security_log_price_change(new.sku_id, format('cost price %s → %s',
    public.security_log_money(old.cost_kobo), public.security_log_money(new.cost_kobo)));
  return null;
end;
$$;

create trigger security_log after update of cost_kobo on public.sku_costs
  for each row execute function public.security_log_sku_costs();

-- ---------- Money at the till ----------

create function public.security_log_returns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return null; end if;
  perform public.security_log_write(auth.uid(), 'money', 'refund',
    format('refunded %s %s on %s (%s): %s',
      public.security_log_money(new.refund_kobo),
      case new.refund_method when 'cash' then 'cash' when 'card' then 'by card reversal' else 'by bank transfer' end,
      (select number from public.sales where id = new.sale_id), new.number, new.reason),
    new.location_id, 'sale', new.sale_id);
  return null;
end;
$$;

-- create_return inserts the return first and fills in refund_kobo once the lines are added.
create trigger security_log after update of refund_kobo on public.returns
  for each row when (old.refund_kobo is distinct from new.refund_kobo)
  execute function public.security_log_returns();

-- Only tills that didn't balance: a balanced close is routine.
create function public.security_log_shifts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parts text[] := '{}';
  v_diff bigint;
  r record;
begin
  if auth.uid() is null or new.status <> 'closed' or old.status = 'closed' then return null; end if;
  for r in
    select * from (values
      ('cash', new.counted_cash_kobo, new.expected_cash_kobo),
      ('POS card', new.counted_card_kobo, new.expected_card_kobo),
      ('transfers', new.counted_transfer_kobo, new.expected_transfer_kobo)
    ) as t(method, counted, expected)
  loop
    if r.counted is not null then
      v_diff := r.counted - coalesce(r.expected, 0);
      if v_diff <> 0 then
        v_parts := v_parts || format('%s %s in %s', public.security_log_money(abs(v_diff)),
          case when v_diff < 0 then 'short' else 'over' end, r.method);
      end if;
    end if;
  end loop;
  if cardinality(v_parts) > 0 then
    perform public.security_log_write(auth.uid(), 'money', 'till_difference',
      'closed the till ' || array_to_string(v_parts, ', ')
        || coalesce(': ' || nullif(trim(new.close_note), ''), ' (no note)'),
      new.location_id, 'shift', new.id);
  end if;
  return null;
end;
$$;

create trigger security_log after update of status on public.shifts
  for each row execute function public.security_log_shifts();

create function public.security_log_drawer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return null; end if;
  perform public.security_log_write(auth.uid(), 'money', 'drawer_open',
    'opened the cash drawer without a sale: ' || new.reason, new.location_id, 'shift', new.shift_id);
  return null;
end;
$$;

create trigger security_log after insert on public.drawer_openings
  for each row execute function public.security_log_drawer();

-- ---------- Online orders ----------

create function public.security_log_online_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Orders that expire unpaid are cancelled by the system, not a person: not logged.
  if auth.uid() is null then return null; end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.security_log_write(auth.uid(), 'money', 'order_cancelled',
      format('cancelled online order %s (%s, %s)%s', new.number, public.security_log_money(new.total_kobo),
        case when new.paid_at is null then 'not paid' else 'paid' end,
        coalesce(': ' || new.cancelled_reason, '')),
      new.location_id, 'online_order', new.id);
  end if;
  if new.refunded_at is not null and old.refunded_at is null then
    perform public.security_log_write(auth.uid(), 'money', 'order_refunded',
      format('marked online order %s as refunded (%s)%s', new.number,
        public.security_log_money(coalesce(new.paid_amount_kobo, new.total_kobo)),
        coalesce(': ' || new.refund_note, '')),
      new.location_id, 'online_order', new.id);
  end if;
  return null;
end;
$$;

create trigger security_log after update of status, refunded_at on public.online_orders
  for each row execute function public.security_log_online_orders();

-- ---------- Stock corrections ----------

-- Logged when a count, write-off or opening stock is approved or rejected. Floor staff submitting one
-- isn't logged: nothing changes until a manager decides.
create function public.security_log_adjustments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items int;
  v_short numeric;
  v_over numeric;
  v_what text;
  v_effect text;
  v_by text;
begin
  if auth.uid() is null or old.status <> 'pending' or new.status = 'pending' then return null; end if;

  select count(*),
    coalesce(sum(case when new.kind = 'damage' then quantity else greatest(system_quantity - quantity, 0) end), 0),
    coalesce(sum(case when new.kind = 'damage' then 0 else greatest(quantity - system_quantity, 0) end), 0)
  into v_items, v_short, v_over
  from public.adjustment_lines where adjustment_id = new.id;

  v_what := case new.kind when 'opening' then 'opening stock' when 'count' then 'stock count' else 'damage write-off' end;
  v_effect := v_items || case when v_items = 1 then ' item' else ' items' end
    || case
      when new.kind = 'damage' then ', ' || public.security_log_qty(v_short) || ' written off'
      when new.kind = 'count' and v_short = 0 and v_over = 0 then ', no difference'
      when new.kind = 'count' then concat_ws(', ', '',
        case when v_short > 0 then public.security_log_qty(v_short) || ' short' end,
        case when v_over > 0 then public.security_log_qty(v_over) || ' over' end)
      else ''
    end;

  if new.status = 'rejected' then
    perform public.security_log_write(auth.uid(), 'stock', 'adjustment_rejected',
      format('rejected %s''s %s %s (%s)%s', public.security_log_person(new.created_by), v_what, new.number,
        v_effect, coalesce(': ' || new.review_note, '')),
      new.location_id, 'adjustment', new.id);
  elsif new.kind = 'opening' then
    perform public.security_log_write(auth.uid(), 'stock', 'opening_stock',
      format('entered opening stock %s (%s)', new.number, v_effect),
      new.location_id, 'adjustment', new.id);
  elsif new.created_by = new.reviewed_by then
    -- A manager or owner's own entry applies at once, with nobody else checking it.
    perform public.security_log_write(auth.uid(), 'stock', 'adjustment_self_approved',
      format('entered a %s %s with no second check (%s)%s', v_what, new.number, v_effect,
        coalesce(': ' || new.note, '')),
      new.location_id, 'adjustment', new.id);
  else
    perform public.security_log_write(auth.uid(), 'stock', 'adjustment_approved',
      format('approved %s''s %s %s (%s)', public.security_log_person(new.created_by), v_what, new.number, v_effect),
      new.location_id, 'adjustment', new.id);
  end if;
  return null;
end;
$$;

create trigger security_log after update of status on public.adjustments
  for each row execute function public.security_log_adjustments();

create function public.security_log_transfers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route text := public.security_log_place(new.from_location_id) || ' → ' || public.security_log_place(new.to_location_id);
  v_sent numeric;
  v_arrived numeric;
begin
  if auth.uid() is null then return null; end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.security_log_write(auth.uid(), 'stock', 'transfer_cancelled',
      format('cancelled transfer %s (%s, was %s)%s', new.number, v_route, old.status,
        coalesce(': ' || nullif(trim(new.cancel_reason), ''), '')),
      new.from_location_id, 'transfer', new.id);
  end if;
  if new.has_shortage and not old.has_shortage then
    select sum(dispatched_quantity), sum(coalesce(received_quantity, 0)) into v_sent, v_arrived
    from public.transfer_items where transfer_id = new.id;
    perform public.security_log_write(auth.uid(), 'stock', 'transfer_short',
      format('received transfer %s (%s) short: %s sent, %s arrived', new.number, v_route,
        public.security_log_qty(v_sent), public.security_log_qty(v_arrived)),
      new.to_location_id, 'transfer', new.id);
  end if;
  if new.shortage_resolved_at is not null and old.shortage_resolved_at is null then
    perform public.security_log_write(auth.uid(), 'stock', 'shortage_resolved',
      format('resolved the shortage on transfer %s (%s): %s', new.number, v_route, new.shortage_resolution),
      new.to_location_id, 'transfer', new.id);
  end if;
  return null;
end;
$$;

create trigger security_log after update on public.transfers
  for each row execute function public.security_log_transfers();

-- A set break-up writes two movements (sets out, pieces in); the log line is written on the second.
create function public.security_log_set_split()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set public.stock_movements;
begin
  if auth.uid() is null or new.type <> 'set_split' or new.quantity < 0 then return null; end if;
  select * into v_set from public.stock_movements
  where type = 'set_split' and reference_id = new.reference_id and quantity < 0
  order by id desc limit 1;
  perform public.security_log_write(auth.uid(), 'stock', 'set_broken_up',
    format('broke up %s × %s into %s × %s', public.security_log_qty(-v_set.quantity),
      public.security_log_sku(v_set.sku_id), public.security_log_qty(new.quantity), public.security_log_sku(new.sku_id)),
    new.location_id);
  return null;
end;
$$;

create trigger security_log after insert on public.stock_movements
  for each row when (new.type = 'set_split') execute function public.security_log_set_split();

-- ---------- Staff and settings ----------

create function public.security_log_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := new.full_name;
  v_parts text[] := '{}';
begin
  if auth.uid() is null then return null; end if;
  if new.is_active is distinct from old.is_active then
    perform public.security_log_write(auth.uid(), 'access', case when new.is_active then 'staff_reactivated' else 'staff_deactivated' end,
      case when new.is_active then 'reactivated ' else 'deactivated ' end || v_name || '''s login');
  end if;
  if new.role is distinct from old.role then
    v_parts := v_parts || format('role %s → %s',
      case old.role when 'warehouse' then 'Warehouse staff' else initcap(old.role::text) end,
      case new.role when 'warehouse' then 'Warehouse staff' else initcap(new.role::text) end);
  end if;
  -- Skipped when the old location was deleted (training reset): the database cleared it, not a person.
  if new.location_id is distinct from old.location_id
    and (old.location_id is null or exists (select 1 from public.locations where id = old.location_id)) then
    v_parts := v_parts || format('location %s → %s',
      public.security_log_place(old.location_id), public.security_log_place(new.location_id));
  end if;
  if new.full_name is distinct from old.full_name then
    v_parts := v_parts || format('name %s → %s', old.full_name, new.full_name);
  end if;
  if cardinality(v_parts) > 0 then
    perform public.security_log_write(auth.uid(), 'access', 'staff_changed',
      'changed ' || v_name || '''s ' || array_to_string(v_parts, ', '));
  end if;
  return null;
end;
$$;

create trigger security_log after update on public.profiles
  for each row execute function public.security_log_profiles();

create function public.security_log_locations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parts text[] := '{}';
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'INSERT' then
    perform public.security_log_write(auth.uid(), 'settings', 'location_added',
      format('added %s %s (%s)', new.kind, new.name, new.code), new.id);
    return null;
  end if;
  if new.is_active is distinct from old.is_active then
    perform public.security_log_write(auth.uid(), 'settings', 'location_active',
      case when new.is_active then 'reopened ' else 'deactivated ' end || new.kind || ' ' || new.name, new.id);
  end if;
  if new.name is distinct from old.name then v_parts := v_parts || format('name %s → %s', old.name, new.name); end if;
  if new.code is distinct from old.code then v_parts := v_parts || format('code %s → %s', old.code, new.code); end if;
  if new.kind is distinct from old.kind then v_parts := v_parts || format('type %s → %s', old.kind, new.kind); end if;
  if cardinality(v_parts) > 0 then
    perform public.security_log_write(auth.uid(), 'settings', 'location_changed',
      'changed location ' || array_to_string(v_parts, ', '), new.id);
  end if;
  return null;
end;
$$;

create trigger security_log after insert or update on public.locations
  for each row execute function public.security_log_locations();

-- Business details, VAT and receipts, and opening or closing the online shop. Website wording, photos
-- and hold times are not security matters and aren't logged.
create function public.security_log_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parts text[] := '{}';
begin
  if auth.uid() is null then return null; end if;
  if new.storefront_enabled is distinct from old.storefront_enabled then
    perform public.security_log_write(auth.uid(), 'settings', 'online_shop',
      case when new.storefront_enabled then 'opened the online shop' else 'closed the online shop' end);
  end if;
  if new.name is distinct from old.name then v_parts := v_parts || format('business name %s → %s', old.name, new.name); end if;
  if new.legal_name is distinct from old.legal_name then v_parts := v_parts || 'registered name'::text; end if;
  if new.phone is distinct from old.phone then v_parts := v_parts || 'phone'::text; end if;
  if new.email is distinct from old.email then v_parts := v_parts || 'email'::text; end if;
  if new.address is distinct from old.address then v_parts := v_parts || 'address'::text; end if;
  if new.currency is distinct from old.currency then v_parts := v_parts || format('currency %s → %s', old.currency, new.currency); end if;
  if new.receipt_footer is distinct from old.receipt_footer then v_parts := v_parts || 'receipt footer'::text; end if;
  if new.vat_enabled is distinct from old.vat_enabled then
    v_parts := v_parts || case when new.vat_enabled then 'VAT on receipts turned on' else 'VAT on receipts turned off' end;
  end if;
  if new.vat_rate is distinct from old.vat_rate then
    v_parts := v_parts || format('VAT rate %s%% → %s%%', public.security_log_qty(old.vat_rate), public.security_log_qty(new.vat_rate));
  end if;
  if new.vat_number is distinct from old.vat_number then v_parts := v_parts || 'VAT / TIN number'::text; end if;
  if cardinality(v_parts) > 0 then
    perform public.security_log_write(auth.uid(), 'settings', 'business_changed',
      'changed business details: ' || array_to_string(v_parts, ', '));
  end if;
  return null;
end;
$$;

create trigger security_log after update on public.business_settings
  for each row execute function public.security_log_business();

create function public.security_log_delivery_areas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'INSERT' then
    perform public.security_log_write(auth.uid(), 'settings', 'delivery_fee',
      format('added delivery area %s at %s', new.name, public.security_log_money(new.fee_kobo)));
  elsif new.fee_kobo is distinct from old.fee_kobo then
    perform public.security_log_write(auth.uid(), 'settings', 'delivery_fee',
      format('changed the delivery fee for %s from %s to %s', new.name,
        public.security_log_money(old.fee_kobo), public.security_log_money(new.fee_kobo)));
  elsif new.is_active is distinct from old.is_active then
    perform public.security_log_write(auth.uid(), 'settings', 'delivery_fee',
      case when new.is_active then 'turned on' else 'turned off' end || ' delivery to ' || new.name);
  end if;
  return null;
end;
$$;

create trigger security_log after insert or update on public.delivery_areas
  for each row execute function public.security_log_delivery_areas();

-- Trigger functions run only as triggers.
revoke execute on function
  public.security_log_price_change(uuid, text),
  public.security_log_skus(),
  public.security_log_sku_costs(),
  public.security_log_returns(),
  public.security_log_shifts(),
  public.security_log_drawer(),
  public.security_log_online_orders(),
  public.security_log_adjustments(),
  public.security_log_transfers(),
  public.security_log_set_split(),
  public.security_log_profiles(),
  public.security_log_locations(),
  public.security_log_business(),
  public.security_log_delivery_areas()
from public, anon, authenticated;
