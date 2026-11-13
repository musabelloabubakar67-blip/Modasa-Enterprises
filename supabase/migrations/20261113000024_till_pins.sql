-- Quick cashier switching at the till with a 4-digit PIN.
--
-- Several people can share one till: each taps their name and enters their PIN instead of typing an email
-- and password, so every sale is recorded under the person who made it. A PIN only opens the till: a PIN
-- sign-in gets the cashier's screens (under the person's own name and discount limit), and anything else
-- needs the full email and password. The till locks itself after a short pause, back to the list of names.
--
-- PINs are set by each person for themselves while signed in with their password, so nobody else knows
-- them. Five wrong PINs in a row lock that person's PIN until they sign in with their password and set a new
-- one. The hashes are unreadable through the site: only the functions below touch them.
--
-- The app starts the PIN sign-in itself (the Auth server has no PIN login), after till_pin_check says yes.

create table public.till_pins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.till_pins enable row level security;
revoke all on public.till_pins from anon, authenticated;

-- Sign-in sessions with something special about them: started with a PIN (till only), or locked at the till.
-- Ordinary password sessions have no row. Rows go when the session ends (sign-out or switching cashier).
create table public.till_sessions (
  session_id uuid primary key references auth.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  -- Started with a PIN: the till only. Never cleared.
  pin boolean not null default false,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);

create index till_sessions_user on public.till_sessions (user_id);

alter table public.till_sessions enable row level security;
create policy "Staff read their own till sessions" on public.till_sessions for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.till_sessions from anon;
revoke insert, update, delete, truncate on public.till_sessions from authenticated;

-- ---------- Setting a PIN ----------

-- The caller sets their own PIN. Only from a password sign-in (the app also asks for the password again),
-- so someone who got in with a PIN can't change it. A new PIN also clears a lock.
create function public.set_till_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_had boolean;
begin
  if public.current_staff_role() is null or public.current_staff_role() = 'warehouse' then
    raise exception 'Only shop staff use the till' using errcode = '42501';
  end if;
  if exists (select 1 from public.till_sessions
             where session_id = (auth.jwt() ->> 'session_id')::uuid and pin) then
    raise exception 'Sign in with your email and password to change your PIN' using errcode = '42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'The PIN must be 4 digits' using errcode = '22023';
  end if;
  if p_pin ~ '^(.)\1{3}$' or p_pin in ('0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765',
                                      '7654', '6543', '5432', '4321', '3210') then
    raise exception 'That PIN is too easy to guess. Choose another.' using errcode = '22023';
  end if;

  v_had := exists (select 1 from public.till_pins where user_id = auth.uid());
  insert into public.till_pins (user_id, pin_hash)
  values (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_at = null, updated_at = now();

  perform public.security_log_write(auth.uid(), 'access', 'till_pin',
    case when v_had then 'changed their till PIN' else 'set up a till PIN' end);
end;
$$;

-- ---------- Who can switch in at a till ----------

-- The names shown on the locked till: the shop's cashiers plus managers and the owner, with whether each
-- has a usable PIN. Any signed-in shop staff member can see it (it is shown on the shared till).
create function public.till_people(p_location uuid)
returns table (id uuid, full_name text, role public.staff_role, has_pin boolean, pin_locked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.role, t.user_id is not null, t.locked_at is not null
  from public.profiles p
  left join public.till_pins t on t.user_id = p.id
  where public.current_staff_role() in ('owner', 'manager', 'cashier')
    and p.is_active
    and (p.role in ('owner', 'manager') or (p.role = 'cashier' and p.location_id = p_location))
  order by case p.role when 'cashier' then 0 when 'manager' then 1 else 2 end, p.full_name
$$;

-- Checks a PIN for someone switching in at this shop. Returns 'ok', 'wrong', 'locked' (now or already),
-- 'no_pin' or 'not_allowed'. Never raises on a wrong PIN, so the count of failed tries is kept.
create function public.till_pin_check(p_user uuid, p_pin text, p_location uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person public.profiles;
  v_pin public.till_pins;
begin
  if public.current_staff_role() not in ('owner', 'manager', 'cashier') then
    return 'not_allowed';
  end if;
  select * into v_person from public.profiles where id = p_user;
  if v_person.id is null or not v_person.is_active
     or not (v_person.role in ('owner', 'manager') or (v_person.role = 'cashier' and v_person.location_id = p_location))
     or not exists (select 1 from public.locations where id = p_location and kind = 'shop' and is_active) then
    return 'not_allowed';
  end if;

  select * into v_pin from public.till_pins where user_id = p_user for update;
  if v_pin.user_id is null then return 'no_pin'; end if;
  if v_pin.locked_at is not null then return 'locked'; end if;

  if v_pin.pin_hash = extensions.crypt(coalesce(p_pin, ''), v_pin.pin_hash) then
    update public.till_pins set failed_attempts = 0 where user_id = p_user and failed_attempts > 0;
    return 'ok';
  end if;

  update public.till_pins set failed_attempts = failed_attempts + 1,
    locked_at = case when failed_attempts + 1 >= 5 then now() end
  where user_id = p_user
  returning * into v_pin;
  if v_pin.locked_at is not null then
    perform public.security_log_write(v_person.id, 'access', 'till_pin_locked',
      'had their till PIN locked after 5 wrong tries', p_location);
    return 'locked';
  end if;
  return 'wrong';
end;
$$;

revoke execute on function public.set_till_pin(text), public.till_people(uuid), public.till_pin_check(uuid, text, uuid)
  from public, anon;
grant execute on function public.set_till_pin(text), public.till_people(uuid), public.till_pin_check(uuid, text, uuid)
  to authenticated;
