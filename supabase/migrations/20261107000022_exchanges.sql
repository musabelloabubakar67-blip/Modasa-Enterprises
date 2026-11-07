-- Returns are exchanges: Modasa gives no cash refunds. Returned items become credit towards a replacement of
-- equal or higher value, bought there and then; the customer tops up any difference. There is no store credit
-- to keep for later, and a cheaper replacement is refused (store policy).
--
-- The credit is a payment method, 'exchange', on the replacement sale. Its amount is what the customer paid for
-- the returned items, and only create_exchange can add it, in the same transaction as the return. In till
-- cash-ups and reports it nets to zero (received on the new sale, "refunded" on the return), so only the
-- top-up counts as money taken.

alter type public.payment_method add value if not exists 'exchange';

-- The replacement sale an exchange paid for, shown on the original sale. Deliberately no foreign key: a second
-- relationship between returns and sales would make the API's sale → returns embeds ambiguous.
alter table public.returns add column exchange_sale_id uuid;

-- ---------- Guards ----------

-- No cash, card or transfer refunds from now on. Earlier returns keep their method.
create function public.returns_exchange_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.refund_method <> 'exchange' then
    raise exception 'Returns are exchanged, never refunded. Use Exchange items on the sale.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger returns_exchange_only before insert on public.returns
  for each row execute function public.returns_exchange_only();

-- Exchange credit exists only inside create_exchange, which marks the transaction while it runs.
create function public.sale_payments_exchange_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.method = 'exchange' and coalesce(current_setting('modasa.exchange_return', true), '') = '' then
    raise exception 'Exchange credit can only come from returned items' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger sale_payments_exchange_guard before insert on public.sale_payments
  for each row execute function public.sale_payments_exchange_guard();

-- ---------- The exchange ----------

-- payload: { return: { sale_id, reason, lines: [{ sale_line_id, quantity, condition }] },
--            sale: <create_sale payload; its payments are the top-up only, empty when nothing is owed> }
-- Returns the replacement sale's id. Everything happens in one transaction: the items come back (damaged ones
-- are written off), the replacement is sold, and nothing is kept if any step fails.
create function public.create_exchange(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.sales;
  v_return uuid;
  v_credit bigint;
  v_value bigint := 0;
  v_line jsonb;
  v_price bigint;
  v_sale_payload jsonb := payload -> 'sale';
  v_sale uuid;
begin
  select * into v_original from public.sales where id = (payload -> 'return' ->> 'sale_id')::uuid;
  if v_original.id is null then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;
  if (v_sale_payload ->> 'location_id')::uuid is distinct from v_original.location_id then
    raise exception 'Exchange at the shop where the items were bought' using errcode = '22023';
  end if;

  -- The return, as credit. create_return checks the till is open, the quantities and the reason.
  v_return := public.create_return((payload -> 'return') || '{"refund_method": "exchange"}'::jsonb);
  select refund_kobo into v_credit from public.returns where id = v_return;

  -- Store policy: the replacement items must be worth at least the credit. Priced as create_sale prices them.
  for v_line in select * from jsonb_array_elements(coalesce(v_sale_payload -> 'lines', '[]'::jsonb)) loop
    select round(coalesce(promo_price_kobo, price_kobo) * (v_line ->> 'quantity')::numeric) into v_price
    from public.skus where id = (v_line ->> 'sku_id')::uuid;
    v_value := v_value + coalesce(v_price, 0);
  end loop;
  if v_value < v_credit then
    raise exception 'The replacement must be worth at least % (the returned items). Choose items of equal or higher value.',
      to_char(v_credit / 100.0, 'FM999,999,999,990.00') using errcode = '22023';
  end if;

  -- The replacement, paid by the credit plus the top-up.
  perform set_config('modasa.exchange_return', v_return::text, true);
  v_sale := public.create_sale(jsonb_set(
    v_sale_payload, '{payments}',
    coalesce(v_sale_payload -> 'payments', '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('method', 'exchange', 'amount_kobo', v_credit,
           'reference', (select number from public.returns where id = v_return)))
  ));
  perform set_config('modasa.exchange_return', '', true);

  update public.returns set exchange_sale_id = v_sale where id = v_return;
  return v_sale;
end;
$$;

revoke execute on function public.create_exchange(jsonb) from public, anon;
grant execute on function public.create_exchange(jsonb) to authenticated;
revoke execute on function public.returns_exchange_only(), public.sale_payments_exchange_guard()
  from public, anon, authenticated;

-- ---------- Security log wording ----------

create or replace function public.security_log_returns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return null; end if;
  perform public.security_log_write(auth.uid(), 'money', 'refund',
    case when new.refund_method = 'exchange' then
      format('exchanged %s of items from %s (%s): %s', public.security_log_money(new.refund_kobo),
        (select number from public.sales where id = new.sale_id), new.number, new.reason)
    else
      format('refunded %s %s on %s (%s): %s',
        public.security_log_money(new.refund_kobo),
        case new.refund_method when 'cash' then 'cash' when 'card' then 'by card reversal' else 'by bank transfer' end,
        (select number from public.sales where id = new.sale_id), new.number, new.reason)
    end,
    new.location_id, 'sale', new.sale_id);
  return null;
end;
$$;
