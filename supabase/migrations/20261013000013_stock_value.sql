-- Stock value at cost, added up in the database. The stock page used to download every stock row and
-- every cost (1,000 rows per request, one request after another) to add them up itself.
--
-- One row per active location, plus a total row with location_id null. uncosted_skus counts items in
-- stock with no cost recorded; on the total row each item counts once however many locations hold it.
-- Security invoker: costs are only visible to owners and managers, so for anyone else every item
-- counts as uncosted and the values are 0.
create function public.stock_value_by_location()
returns table (location_id uuid, value_kobo bigint, uncosted_skus bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    l.location_id,
    coalesce(sum(round(l.quantity * c.cost_kobo)), 0)::bigint,
    count(distinct l.sku_id) filter (where c.cost_kobo is null)
  from public.sku_location_stock l
  join public.locations loc on loc.id = l.location_id and loc.is_active
  left join public.sku_costs c on c.sku_id = l.sku_id
  where l.quantity > 0
  group by grouping sets ((l.location_id), ())
$$;

revoke execute on function public.stock_value_by_location() from public, anon;
grant execute on function public.stock_value_by_location() to authenticated;
