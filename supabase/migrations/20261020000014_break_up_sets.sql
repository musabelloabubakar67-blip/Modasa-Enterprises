-- Breaking up a set: some sets (figurine sets, cutlery, pot sets) may one day be sold as single pieces.
-- The set and the single piece are separate items, so breaking up is two stock movements at one location:
-- the sets out, the pieces in. Its own movement type keeps it out of the losses report.

alter type public.movement_type add value if not exists 'set_split';

create function public.break_up_set(
  p_location_id uuid,
  p_set_sku_id uuid,
  p_sets numeric,
  p_piece_sku_id uuid,
  p_pieces_per_set numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference uuid := gen_random_uuid();
  v_set record;
  v_piece record;
  v_note text;
begin
  if not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can break up sets' using errcode = '42501';
  end if;
  if not exists (select 1 from public.locations where id = p_location_id and is_active) then
    raise exception 'Choose an active location' using errcode = '22023';
  end if;
  if p_set_sku_id = p_piece_sku_id then
    raise exception 'The set and the single piece must be different items' using errcode = '22023';
  end if;
  if coalesce(p_sets, 0) <= 0 or coalesce(p_pieces_per_set, 0) <= 0 then
    raise exception 'Enter how many sets and how many pieces are in each' using errcode = '22023';
  end if;

  select s.code, p.track_batches into v_set
  from public.skus s join public.products p on p.id = s.product_id where s.id = p_set_sku_id;
  select s.code, p.track_batches into v_piece
  from public.skus s join public.products p on p.id = s.product_id where s.id = p_piece_sku_id;
  if v_set.code is null or v_piece.code is null then
    raise exception 'Unknown item' using errcode = 'P0002';
  end if;
  if v_set.track_batches or v_piece.track_batches then
    raise exception 'Items that track batches can''t be broken up here' using errcode = '22023';
  end if;

  v_note := concat_ws(' · ',
    format('Broke up %s × %s into %s × %s', p_sets, v_set.code, p_sets * p_pieces_per_set, v_piece.code),
    nullif(trim(p_note), ''));
  -- Sets first: this fails if there aren't enough of them at the location.
  perform public.apply_stock_movement(p_set_sku_id, p_location_id, '', -p_sets, 'set_split', 'set_split', v_reference, v_note);
  perform public.apply_stock_movement(
    p_piece_sku_id, p_location_id, '', p_sets * p_pieces_per_set, 'set_split', 'set_split', v_reference, v_note
  );
  return v_reference;
end;
$$;

revoke execute on function public.break_up_set(uuid, uuid, numeric, uuid, numeric, text) from public, anon;
grant execute on function public.break_up_set(uuid, uuid, numeric, uuid, numeric, text) to authenticated;
