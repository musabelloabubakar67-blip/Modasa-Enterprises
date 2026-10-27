-- Fix for 20261027000017: Supabase's safeupdate guard refuses `delete from public.locations` without a WHERE
-- clause when the reset is called from the app, so the whole reset was rolled back. Same function, with one.

create or replace function public.reset_training_data(p_locations boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_floor_staff text;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can reset training data' using errcode = '42501';
  end if;
  if not public.is_training_copy() then
    raise exception 'This is not a training copy, so its data can''t be reset' using errcode = '42501';
  end if;
  if p_locations then
    select string_agg(full_name, ', ' order by full_name) into v_floor_staff
    from public.profiles where role not in ('owner', 'manager');
    if v_floor_staff is not null then
      raise exception 'Cashiers and warehouse staff must belong to a shop or warehouse: %. Change their role, or reset without deleting locations.', v_floor_staff
        using errcode = '23514';
    end if;
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

  -- Everything that pointed at a location is gone; staff lose theirs (owners and managers only, checked above).
  if p_locations then
    -- Supabase refuses a DELETE without a WHERE clause (safeupdate), even inside a function.
    delete from public.locations where id is not null;
  end if;

  -- Numbering starts again at 1 (INV-000001, ADJ-00001, …).
  alter sequence public.sale_number_seq restart;
  alter sequence public.return_number_seq restart;
  alter sequence public.receipt_number_seq restart;
  alter sequence public.adjustment_number_seq restart;
  alter sequence public.transfer_number_seq restart;
  alter sequence public.online_order_number_seq restart;
end;
$$;
