-- Foundation: business settings, locations, staff profiles, roles and access rules.

create type public.location_kind as enum ('shop', 'warehouse');
create type public.staff_role as enum ('owner', 'manager', 'cashier', 'warehouse');

-- Single-row table holding everything business-specific, so the app itself stays generic.
create table public.business_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'My Business',
  legal_name text,
  phone text,
  email text,
  address text,
  logo_url text,
  currency text not null default 'NGN',
  receipt_footer text,
  updated_at timestamptz not null default now()
);

insert into public.business_settings (id) values (1);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique check (code ~ '^[A-Z0-9-]{2,10}$'),
  kind public.location_kind not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role public.staff_role not null,
  location_id uuid references public.locations (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Cashiers and warehouse staff always work from one location.
  constraint location_required_for_floor_staff
    check (role in ('owner', 'manager') or location_id is not null)
);

create index profiles_location_id_idx on public.profiles (location_id);

-- Create a profile whenever an auth user is created. Staff are only ever created by the
-- server (service role) with name/role/location passed in user metadata.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role, location_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_user_meta_data ->> 'role')::public.staff_role, 'cashier'),
    nullif(new.raw_user_meta_data ->> 'location_id', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers used by row-level security. security definer avoids recursive policy checks on profiles.
create function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create function public.current_staff_location()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select location_id from public.profiles where id = auth.uid() and is_active
$$;

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() = 'owner', false)
$$;

-- Row-level security

alter table public.business_settings enable row level security;
alter table public.locations enable row level security;
alter table public.profiles enable row level security;

create policy "Active staff can read business settings"
  on public.business_settings for select to authenticated
  using (public.current_staff_role() is not null);

create policy "Owner can update business settings"
  on public.business_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Every staff member can see every location (needed for "available at another location").
create policy "Active staff can read locations"
  on public.locations for select to authenticated
  using (public.current_staff_role() is not null);

create policy "Owner can add locations"
  on public.locations for insert to authenticated
  with check (public.is_owner());

create policy "Owner can update locations"
  on public.locations for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "Staff can read own profile; owner and managers read all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_staff_role() in ('owner', 'manager'));

create policy "Owner can update profiles"
  on public.profiles for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- The storefront (later) reads through server code, so anon gets nothing for now.
revoke all on public.business_settings, public.locations, public.profiles from anon;
