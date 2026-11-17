-- The stock check's messages in plain words. Before: "Not enough stock: HM-1 at Shop 1 would go to -98.000".
-- After: "Not enough stock: only 2 pc of Foot Mat · Leg mat at Shop 1." Every sale, transfer, write-off, count and
-- set break-up goes through this one function, so they all read the same. Nothing else changes.

create or replace function public.apply_stock_movement(
  p_sku_id uuid,
  p_location_id uuid,
  p_batch text,
  p_quantity numeric,
  p_type public.movement_type,
  p_reference_type text,
  p_reference_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allows_decimal boolean;
  v_code text;
  v_item text;
  v_unit text;
  v_location text;
  v_new numeric;
begin
  select u.allows_decimal, s.code, p.name || coalesce(' · ' || s.variant_label, ''), u.abbreviation
  into v_allows_decimal, v_code, v_item, v_unit
  from public.skus s join public.products p on p.id = s.product_id join public.units u on u.id = p.unit_id
  where s.id = p_sku_id;
  if v_code is null then
    raise exception 'That item no longer exists' using errcode = 'P0002';
  end if;
  if not v_allows_decimal and p_quantity <> trunc(p_quantity) then
    raise exception '% is sold in whole numbers (%), not %', v_item, v_unit,
      public.security_log_qty(abs(p_quantity)) using errcode = '22023';
  end if;

  insert into public.stock_movements (
    sku_id, location_id, batch, quantity, type, reference_type, reference_id, note, created_by
  ) values (
    p_sku_id, p_location_id, coalesce(trim(p_batch), ''), p_quantity, p_type, p_reference_type, p_reference_id,
    p_note, auth.uid()
  );

  insert into public.stock_levels (sku_id, location_id, batch, quantity)
  values (p_sku_id, p_location_id, coalesce(trim(p_batch), ''), p_quantity)
  on conflict (sku_id, location_id, batch)
  do update set quantity = public.stock_levels.quantity + excluded.quantity, updated_at = now()
  returning quantity into v_new;

  if v_new < 0 then
    select name into v_location from public.locations where id = p_location_id;
    raise exception 'Not enough stock: only % % of % at %.',
      public.security_log_qty(greatest(v_new - p_quantity, 0)), v_unit,
      v_item || case when coalesce(trim(p_batch), '') <> '' then ' (batch ' || trim(p_batch) || ')' else '' end,
      v_location using errcode = 'P0001';
  end if;
end;
$$;
