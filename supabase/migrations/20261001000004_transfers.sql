-- Transfers between any two locations: requested -> dispatched (stock leaves the source and is
-- "in transit") -> received (stock arrives at the destination). Shortfalls on receipt are flagged
-- for a manager. All writes go through the functions below.

create type public.transfer_status as enum ('requested', 'dispatched', 'received', 'cancelled');

create sequence public.transfer_number_seq;

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default 'TRF-' || lpad(nextval('public.transfer_number_seq')::text, 5, '0'),
  from_location_id uuid not null references public.locations (id),
  to_location_id uuid not null references public.locations (id),
  status public.transfer_status not null default 'requested',
  note text,
  requested_by uuid references public.profiles (id),
  requested_at timestamptz not null default now(),
  dispatched_by uuid references public.profiles (id),
  dispatched_at timestamptz,
  dispatch_note text,
  received_by uuid references public.profiles (id),
  received_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  cancelled_at timestamptz,
  cancel_reason text,
  -- Set when fewer items arrived than were sent; cleared by a manager's resolution.
  has_shortage boolean not null default false,
  shortage_resolution text,
  shortage_resolved_by uuid references public.profiles (id),
  shortage_resolved_at timestamptz,
  constraint different_locations check (from_location_id <> to_location_id)
);

create index transfers_from_idx on public.transfers (from_location_id, status);
create index transfers_to_idx on public.transfers (to_location_id, status);
create index transfers_status_idx on public.transfers (status, requested_at desc);

-- What was asked for, per SKU.
create table public.transfer_lines (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.transfers (id) on delete cascade,
  sku_id uuid not null references public.skus (id),
  requested_quantity numeric(12, 3) not null check (requested_quantity > 0),
  sort_order int not null default 0,
  unique (transfer_id, sku_id)
);

-- What was actually sent and received, per SKU and batch.
create table public.transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.transfers (id) on delete cascade,
  sku_id uuid not null references public.skus (id),
  batch text not null default '',
  dispatched_quantity numeric(12, 3) not null check (dispatched_quantity > 0),
  received_quantity numeric(12, 3) check (received_quantity >= 0 and received_quantity <= dispatched_quantity),
  shortage_reason text,
  sort_order int not null default 0,
  unique (transfer_id, sku_id, batch)
);

create index transfer_lines_transfer_idx on public.transfer_lines (transfer_id);
create index transfer_items_transfer_idx on public.transfer_items (transfer_id);

-- Staff act at a transfer's source or destination; managers anywhere.
create function public.assert_at_either_end(p_from uuid, p_to uuid)
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
  if not public.is_manager_or_owner()
     and public.current_staff_location() is distinct from p_from
     and public.current_staff_location() is distinct from p_to then
    raise exception 'You can only create transfers to or from your own location' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_at_either_end(uuid, uuid) from public, anon;

-- payload: { from_location_id, to_location_id, note?, lines: [{ sku_id, quantity }] }
create function public.create_transfer(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from uuid := (payload ->> 'from_location_id')::uuid;
  v_to uuid := (payload ->> 'to_location_id')::uuid;
  v_id uuid;
  v_line jsonb;
  v_order int := 0;
begin
  perform public.assert_at_either_end(v_from, v_to);
  if v_from = v_to then
    raise exception 'Choose two different locations' using errcode = '22023';
  end if;
  if exists (select 1 from public.locations where id in (v_from, v_to) and not is_active) then
    raise exception 'One of these locations is inactive' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(payload -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one item' using errcode = '22023';
  end if;

  insert into public.transfers (from_location_id, to_location_id, note, requested_by)
  values (v_from, v_to, nullif(trim(payload ->> 'note'), ''), auth.uid())
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(payload -> 'lines') loop
    v_order := v_order + 1;
    insert into public.transfer_lines (transfer_id, sku_id, requested_quantity, sort_order)
    values (v_id, (v_line ->> 'sku_id')::uuid, (v_line ->> 'quantity')::numeric, v_order);
  end loop;

  return v_id;
end;
$$;

-- items: [{ sku_id, batch?, quantity }] — what is actually being sent. Stock leaves the source now.
create function public.dispatch_transfer(p_transfer_id uuid, p_items jsonb, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.transfers;
  v_item jsonb;
  v_sku uuid;
  v_batch text;
  v_qty numeric;
  v_track boolean;
  v_code text;
  v_order int := 0;
begin
  select * into v_t from public.transfers where id = p_transfer_id for update;
  if v_t.id is null then
    raise exception 'Transfer not found' using errcode = 'P0002';
  end if;
  perform public.assert_can_act_at(v_t.from_location_id);
  if v_t.status <> 'requested' then
    raise exception 'This transfer has already been %', v_t.status using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_sku := (v_item ->> 'sku_id')::uuid;
    v_batch := coalesce(trim(v_item ->> 'batch'), '');
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;
    if not exists (select 1 from public.transfer_lines where transfer_id = p_transfer_id and sku_id = v_sku) then
      raise exception 'Only requested items can be sent' using errcode = '22023';
    end if;
    select p.track_batches, s.code into v_track, v_code
    from public.skus s join public.products p on p.id = s.product_id where s.id = v_sku;
    if not v_track and v_batch <> '' then
      raise exception '% does not track batches', v_code using errcode = '22023';
    end if;

    v_order := v_order + 1;
    insert into public.transfer_items (transfer_id, sku_id, batch, dispatched_quantity, sort_order)
    values (p_transfer_id, v_sku, v_batch, v_qty, v_order);

    perform public.apply_stock_movement(
      v_sku, v_t.from_location_id, v_batch, -v_qty, 'transfer_out', 'transfer', p_transfer_id,
      v_t.number || ' → ' || (select name from public.locations where id = v_t.to_location_id)
    );
  end loop;

  if v_order = 0 then
    raise exception 'Enter at least one quantity to send' using errcode = '22023';
  end if;

  update public.transfers
  set status = 'dispatched', dispatched_by = auth.uid(), dispatched_at = now(),
      dispatch_note = nullif(trim(p_note), '')
  where id = p_transfer_id;
end;
$$;

-- items: [{ item_id, received_quantity, reason? }] — one entry per dispatched item.
create function public.receive_transfer(p_transfer_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.transfers;
  v_row record;
  v_received numeric;
  v_reason text;
  v_short boolean := false;
begin
  select * into v_t from public.transfers where id = p_transfer_id for update;
  if v_t.id is null then
    raise exception 'Transfer not found' using errcode = 'P0002';
  end if;
  perform public.assert_can_act_at(v_t.to_location_id);
  if v_t.status <> 'dispatched' then
    raise exception 'Only dispatched transfers can be received (this one is %)', v_t.status using errcode = '22023';
  end if;

  for v_row in select * from public.transfer_items where transfer_id = p_transfer_id order by sort_order loop
    select (e ->> 'received_quantity')::numeric, nullif(trim(e ->> 'reason'), '')
    into v_received, v_reason
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
    where (e ->> 'item_id')::uuid = v_row.id;

    if v_received is null then
      raise exception 'Enter the quantity received for every item' using errcode = '22023';
    end if;
    if v_received < 0 or v_received > v_row.dispatched_quantity then
      raise exception 'Received quantity must be between 0 and the % sent', v_row.dispatched_quantity using errcode = '22023';
    end if;
    if v_received < v_row.dispatched_quantity then
      v_short := true;
      if v_reason is null then
        raise exception 'Say why fewer items arrived than were sent' using errcode = '22023';
      end if;
    end if;

    update public.transfer_items
    set received_quantity = v_received, shortage_reason = case when v_received < dispatched_quantity then v_reason end
    where id = v_row.id;

    if v_received > 0 then
      perform public.apply_stock_movement(
        v_row.sku_id, v_t.to_location_id, v_row.batch, v_received, 'transfer_in', 'transfer', p_transfer_id,
        v_t.number || ' ← ' || (select name from public.locations where id = v_t.from_location_id)
      );
    end if;
  end loop;

  update public.transfers
  set status = 'received', received_by = auth.uid(), received_at = now(), has_shortage = v_short
  where id = p_transfer_id;
end;
$$;

create function public.cancel_transfer(p_transfer_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.transfers;
begin
  select * into v_t from public.transfers where id = p_transfer_id for update;
  if v_t.id is null then
    raise exception 'Transfer not found' using errcode = 'P0002';
  end if;
  perform public.assert_at_either_end(v_t.from_location_id, v_t.to_location_id);
  if v_t.status <> 'requested' then
    raise exception 'Only requests that have not been sent can be cancelled' using errcode = '22023';
  end if;
  update public.transfers
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = nullif(trim(p_reason), '')
  where id = p_transfer_id;
end;
$$;

-- A manager closes a shortage: e.g. "Lost in transit — driver reported breakage".
create function public.resolve_transfer_shortage(p_transfer_id uuid, p_resolution text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can resolve shortages' using errcode = '42501';
  end if;
  if nullif(trim(p_resolution), '') is null then
    raise exception 'Describe what happened' using errcode = '22023';
  end if;
  update public.transfers
  set shortage_resolution = trim(p_resolution), shortage_resolved_by = auth.uid(), shortage_resolved_at = now()
  where id = p_transfer_id and has_shortage and shortage_resolved_at is null;
  if not found then
    raise exception 'There is no open shortage on this transfer' using errcode = '22023';
  end if;
end;
$$;

-- ---------- In transit ----------

create view public.stock_in_transit with (security_invoker = true) as
select i.sku_id, t.to_location_id as location_id, sum(i.dispatched_quantity) as quantity
from public.transfer_items i
join public.transfers t on t.id = i.transfer_id
where t.status = 'dispatched'
group by i.sku_id, t.to_location_id;

-- ---------- Row-level security ----------

alter table public.transfers enable row level security;
alter table public.transfer_lines enable row level security;
alter table public.transfer_items enable row level security;

-- Staff see transfers to or from their location. In-transit totals use every dispatched transfer,
-- so floor staff also need to see those (quantities only, no costs are involved).
create policy "Staff read relevant transfers" on public.transfers for select to authenticated
  using (
    public.is_manager_or_owner()
    or public.current_staff_location() in (from_location_id, to_location_id)
    or (public.current_staff_role() is not null and status = 'dispatched')
  );
create policy "Staff read transfer lines" on public.transfer_lines for select to authenticated
  using (exists (select 1 from public.transfers t where t.id = transfer_id));
create policy "Staff read transfer items" on public.transfer_items for select to authenticated
  using (exists (select 1 from public.transfers t where t.id = transfer_id));

revoke all on public.transfers, public.transfer_lines, public.transfer_items, public.stock_in_transit from anon;
revoke insert, update, delete, truncate on public.transfers, public.transfer_lines, public.transfer_items
  from authenticated;
grant select on public.stock_in_transit to authenticated;

revoke execute on function
  public.create_transfer(jsonb), public.dispatch_transfer(uuid, jsonb, text), public.receive_transfer(uuid, jsonb),
  public.cancel_transfer(uuid, text), public.resolve_transfer_shortage(uuid, text)
  from public, anon;
grant execute on function
  public.create_transfer(jsonb), public.dispatch_transfer(uuid, jsonb, text), public.receive_transfer(uuid, jsonb),
  public.cancel_transfer(uuid, text), public.resolve_transfer_shortage(uuid, text)
  to authenticated;
