-- Cancelling an online order that was waiting for warehouse stock now also cancels the transfer the system
-- requested for it, as long as that transfer hasn't been sent. Before, the request stayed open and the
-- warehouse could still send the goods to a shop for an order that no longer existed. A transfer already on
-- its way is left alone: the stock simply arrives at the shop.
--
-- The request is the one confirm_online_order made for this order: to the order's shop, with its standard note.

create or replace function public.cancel_online_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.online_orders;
begin
  if not public.is_manager_or_owner() then
    raise exception 'Only owners and managers can cancel online orders' using errcode = '42501';
  end if;
  select * into v_order from public.online_orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('pending_payment', 'paid', 'awaiting_stock') then
    raise exception 'This order can no longer be cancelled here' using errcode = '22023';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason' using errcode = '22023';
  end if;
  delete from public.stock_holds where order_id = p_order_id;
  update public.online_orders set
    status = 'cancelled',
    cancelled_reason = trim(p_reason),
    attention = case when paid_at is not null then 'Cancelled after payment: refund the customer.' end
  where id = p_order_id;

  update public.transfers set
    status = 'cancelled',
    cancelled_by = auth.uid(),
    cancelled_at = now(),
    cancel_reason = 'Online order ' || v_order.number || ' was cancelled'
  where status = 'requested'
    and to_location_id = v_order.location_id
    and note = 'Online order ' || v_order.number || ' (paid) — customer is waiting';
end;
$$;
