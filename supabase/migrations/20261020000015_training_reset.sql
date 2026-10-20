-- Reset for the training copy: the owner can wipe products, stock and sales and start again, keeping
-- logins, business settings, locations, units and delivery areas.
--
-- Off unless the database is marked as a training copy, which only someone with database access can do
-- (SQL Editor): insert into public.instance_flags (name) values ('training_copy');
-- Never run that on the live system.

create table public.instance_flags (
  name text primary key,
  set_at timestamptz not null default now()
);
-- No policies: the app can't read or change flags directly, only through the functions below.
alter table public.instance_flags enable row level security;
revoke all on public.instance_flags from anon, authenticated;

create function public.is_training_copy()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.instance_flags where name = 'training_copy')
$$;

create function public.reset_training_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can reset training data' using errcode = '42501';
  end if;
  if not public.is_training_copy() then
    raise exception 'This is not a training copy, so its data can''t be reset' using errcode = '42501';
  end if;

  -- No cascade: if a table that is kept ever points at one of these, this fails instead of wiping it too.
  truncate
    public.online_order_lines, public.stock_holds, public.online_orders,
    public.return_lines, public.returns, public.sale_line_costs, public.sale_payments, public.sale_lines,
    public.sales, public.drawer_openings, public.shifts, public.customers,
    public.transfer_items, public.transfer_lines, public.transfers,
    public.adjustment_lines, public.adjustments, public.receipt_costs, public.receipt_lines, public.receipts,
    public.stock_movements, public.stock_levels, public.reorder_levels,
    public.product_images, public.sku_costs, public.skus, public.products, public.categories
    restart identity;

  -- Numbering starts again at 1 (INV-000001, ADJ-00001, …).
  alter sequence public.sale_number_seq restart;
  alter sequence public.return_number_seq restart;
  alter sequence public.receipt_number_seq restart;
  alter sequence public.adjustment_number_seq restart;
  alter sequence public.transfer_number_seq restart;
  alter sequence public.online_order_number_seq restart;
end;
$$;

revoke execute on function public.is_training_copy(), public.reset_training_data() from public, anon;
grant execute on function public.is_training_copy(), public.reset_training_data() to authenticated;
