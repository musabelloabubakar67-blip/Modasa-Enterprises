-- Reports: cost at the time of sale (for honest profit figures) and report queries.
-- All report functions are security invoker, so row-level security applies: costs are only
-- visible to owners and managers, and floor staff only ever see their own location.

-- ---------- Cost snapshot per sale line ----------

-- Kept apart from sale_lines because cashiers can read sale lines but must not see costs.
create table public.sale_line_costs (
  sale_line_id uuid primary key references public.sale_lines (id) on delete cascade,
  cost_kobo bigint not null check (cost_kobo >= 0)
);

alter table public.sale_line_costs enable row level security;
create policy "Managers read sale costs" on public.sale_line_costs for select to authenticated
  using (public.is_manager_or_owner());
revoke all on public.sale_line_costs from anon;
revoke insert, update, delete, truncate on public.sale_line_costs from authenticated;

-- Record the item's cost price as it was at the moment of sale. If the cost changes later, past
-- margins stay as they were. Items with no cost price are simply "cost unknown".
create function public.snapshot_sale_line_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sale_line_costs (sale_line_id, cost_kobo)
  select new.id, c.cost_kobo from public.sku_costs c where c.sku_id = new.sku_id;
  return new;
end;
$$;

create trigger sale_lines_cost_snapshot
  after insert on public.sale_lines
  for each row execute function public.snapshot_sale_line_cost();

-- ---------- Helpers ----------

create function public.business_date(p_at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_at at time zone 'Africa/Lagos')::date
$$;

-- ---------- Sales by day and shop ----------

create function public.report_sales_daily(p_from date, p_to date, p_location uuid default null)
returns table (
  day date,
  location_id uuid,
  sales_count bigint,
  gross_kobo bigint,
  refunds_kobo bigint,
  items_sold numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with s as (
    select public.business_date(created_at) as day, location_id, count(*) as n, sum(total_kobo) as gross
    from public.sales
    where public.business_date(created_at) between p_from and p_to
      and (p_location is null or location_id = p_location)
    group by 1, 2
  ),
  i as (
    select public.business_date(s.created_at) as day, s.location_id, sum(l.quantity) as qty
    from public.sale_lines l join public.sales s on s.id = l.sale_id
    where public.business_date(s.created_at) between p_from and p_to
      and (p_location is null or s.location_id = p_location)
    group by 1, 2
  ),
  r as (
    select public.business_date(created_at) as day, location_id, sum(refund_kobo) as refunds
    from public.returns
    where public.business_date(created_at) between p_from and p_to
      and (p_location is null or location_id = p_location)
    group by 1, 2
  )
  select
    coalesce(s.day, r.day),
    coalesce(s.location_id, r.location_id),
    coalesce(s.n, 0),
    coalesce(s.gross, 0)::bigint,
    coalesce(r.refunds, 0)::bigint,
    coalesce(i.qty, 0)
  from s
  full join r on r.day = s.day and r.location_id = s.location_id
  left join i on i.day = s.day and i.location_id = s.location_id
  order by 1, 2
$$;

-- ---------- Payments by method (refunds subtracted) ----------

create function public.report_payments(p_from date, p_to date, p_location uuid default null)
returns table (method public.payment_method, received_kobo bigint, refunded_kobo bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with m(method) as (select unnest(enum_range(null::public.payment_method))),
  p as (
    select p.method, sum(p.amount_kobo) as amount
    from public.sale_payments p join public.sales s on s.id = p.sale_id
    where public.business_date(s.created_at) between p_from and p_to
      and (p_location is null or s.location_id = p_location)
    group by 1
  ),
  r as (
    select refund_method as method, sum(refund_kobo) as amount
    from public.returns
    where public.business_date(created_at) between p_from and p_to
      and (p_location is null or location_id = p_location)
    group by 1
  )
  select m.method, coalesce(p.amount, 0)::bigint, coalesce(r.amount, 0)::bigint
  from m left join p on p.method = m.method left join r on r.method = m.method
$$;

-- ---------- Products: quantity, revenue, cost, margin ----------

-- Net of returns. cost_kobo covers only the quantity whose cost was known at the time of sale;
-- costed_revenue_kobo is the matching revenue, so margins are never computed on missing costs.
create function public.report_products(p_from date, p_to date, p_location uuid default null)
returns table (
  sku_id uuid,
  code text,
  product_name text,
  variant_label text,
  category_name text,
  unit text,
  quantity numeric,
  revenue_kobo bigint,
  costed_revenue_kobo bigint,
  cost_kobo bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with lines as (
    select
      l.sku_id,
      l.quantity - l.returned_quantity as qty,
      l.line_total_kobo - coalesce((select sum(rl.refund_kobo) from public.return_lines rl where rl.sale_line_id = l.id), 0) as revenue,
      c.cost_kobo
    from public.sale_lines l
    join public.sales s on s.id = l.sale_id
    left join public.sale_line_costs c on c.sale_line_id = l.id
    where public.business_date(s.created_at) between p_from and p_to
      and (p_location is null or s.location_id = p_location)
  )
  select
    k.id, k.code, p.name, k.variant_label, cat.name, u.abbreviation,
    sum(lines.qty),
    sum(lines.revenue)::bigint,
    sum(case when lines.cost_kobo is not null then lines.revenue else 0 end)::bigint,
    sum(case when lines.cost_kobo is not null then round(lines.cost_kobo * lines.qty) else 0 end)::bigint
  from lines
  join public.skus k on k.id = lines.sku_id
  join public.products p on p.id = k.product_id
  join public.categories cat on cat.id = p.category_id
  join public.units u on u.id = p.unit_id
  group by k.id, k.code, p.name, k.variant_label, cat.name, u.abbreviation
  order by 8 desc
$$;

-- ---------- Slow movers: in stock, not sold for a while ----------

create function public.report_slow_movers(p_days int, p_location uuid default null)
returns table (
  sku_id uuid,
  code text,
  product_name text,
  variant_label text,
  location_id uuid,
  quantity numeric,
  last_sold_at timestamptz,
  cost_kobo bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    k.id, k.code, p.name, k.variant_label, ls.location_id, ls.quantity,
    (select max(s.created_at) from public.sale_lines l join public.sales s on s.id = l.sale_id where l.sku_id = k.id),
    c.cost_kobo
  from public.sku_location_stock ls
  join public.skus k on k.id = ls.sku_id
  join public.products p on p.id = k.product_id
  left join public.sku_costs c on c.sku_id = k.id
  where ls.quantity > 0
    and k.is_active and p.is_active
    and (p_location is null or ls.location_id = p_location)
    and not exists (
      select 1 from public.sale_lines l join public.sales s on s.id = l.sale_id
      where l.sku_id = k.id and s.created_at > now() - make_interval(days => p_days)
    )
  order by ls.quantity * coalesce(c.cost_kobo, 0) desc, p.name
$$;

-- ---------- Staff ----------

create function public.report_staff(p_from date, p_to date, p_location uuid default null)
returns table (
  staff_id uuid,
  sales_count bigint,
  sales_kobo bigint,
  returns_count bigint,
  returns_kobo bigint,
  drawer_openings bigint,
  sessions_closed bigint,
  cash_difference_kobo bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with s as (
    select cashier_id as id, count(*) as n, sum(total_kobo) as amount from public.sales
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
    coalesce(c.n, 0), coalesce(c.diff, 0)::bigint
  from ids
  left join s on s.id = ids.id
  left join r on r.id = ids.id
  left join d on d.id = ids.id
  left join c on c.id = ids.id
  where ids.id is not null
$$;

-- ---------- Stock losses ----------

-- Write-offs (damage, incl. damaged returns), stock counts that found less than expected, and
-- items that never arrived on transfers. Valued at the item's current cost price.
create function public.report_losses(p_from date, p_to date, p_location uuid default null)
returns table (
  kind text,
  location_id uuid,
  sku_id uuid,
  code text,
  product_name text,
  variant_label text,
  quantity numeric,
  value_kobo bigint,
  reason text,
  happened_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case m.type when 'damage' then 'Write-off' else 'Count shortfall' end,
    m.location_id, m.sku_id, k.code, p.name, k.variant_label,
    -m.quantity,
    round(-m.quantity * c.cost_kobo)::bigint,
    m.note,
    m.created_at
  from public.stock_movements m
  join public.skus k on k.id = m.sku_id
  join public.products p on p.id = k.product_id
  left join public.sku_costs c on c.sku_id = m.sku_id
  where (m.type = 'damage' or (m.type = 'count_correction' and m.quantity < 0))
    and public.business_date(m.created_at) between p_from and p_to
    and (p_location is null or m.location_id = p_location)
  union all
  select
    'Lost in transit',
    t.from_location_id, i.sku_id, k.code, p.name, k.variant_label,
    i.dispatched_quantity - i.received_quantity,
    round((i.dispatched_quantity - i.received_quantity) * c.cost_kobo)::bigint,
    concat_ws(' · ', t.number, i.shortage_reason),
    t.received_at
  from public.transfer_items i
  join public.transfers t on t.id = i.transfer_id
  join public.skus k on k.id = i.sku_id
  join public.products p on p.id = k.product_id
  left join public.sku_costs c on c.sku_id = i.sku_id
  where i.received_quantity < i.dispatched_quantity
    and public.business_date(t.received_at) between p_from and p_to
    and (p_location is null or t.from_location_id = p_location or t.to_location_id = p_location)
  order by 10 desc
$$;

revoke execute on function
  public.report_sales_daily(date, date, uuid), public.report_payments(date, date, uuid),
  public.report_products(date, date, uuid), public.report_slow_movers(int, uuid),
  public.report_staff(date, date, uuid), public.report_losses(date, date, uuid)
  from public, anon;
grant execute on function
  public.report_sales_daily(date, date, uuid), public.report_payments(date, date, uuid),
  public.report_products(date, date, uuid), public.report_slow_movers(int, uuid),
  public.report_staff(date, date, uuid), public.report_losses(date, date, uuid)
  to authenticated;
