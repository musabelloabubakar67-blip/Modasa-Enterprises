-- Every time the cash drawer is opened without a sale ("no sale"), who did it and why is recorded.
-- Shown with the till session at cash-up, a standard check against cash going missing.

create table public.drawer_openings (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id),
  location_id uuid not null references public.locations (id),
  opened_by uuid references public.profiles (id),
  reason text not null,
  created_at timestamptz not null default now()
);

create index drawer_openings_shift_idx on public.drawer_openings (shift_id);

create function public.log_drawer_open(p_location_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift uuid;
begin
  perform public.assert_can_sell_at(p_location_id);
  if nullif(trim(p_reason), '') is null then
    raise exception 'Say why the drawer is being opened' using errcode = '22023';
  end if;
  select id into v_shift from public.shifts where location_id = p_location_id and status = 'open';
  if v_shift is null then
    raise exception 'The till is not open' using errcode = '22023';
  end if;
  insert into public.drawer_openings (shift_id, location_id, opened_by, reason)
  values (v_shift, p_location_id, auth.uid(), trim(p_reason));
end;
$$;

alter table public.drawer_openings enable row level security;

create policy "Staff read drawer openings at their shop" on public.drawer_openings for select to authenticated
  using (public.is_manager_or_owner() or location_id = public.current_staff_location());

revoke all on public.drawer_openings from anon;
revoke insert, update, delete, truncate on public.drawer_openings from authenticated;
revoke execute on function public.log_drawer_open(uuid, text) from public, anon;
grant execute on function public.log_drawer_open(uuid, text) to authenticated;
