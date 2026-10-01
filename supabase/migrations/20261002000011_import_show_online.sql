-- Importing a spreadsheet can also say whether each product is shown on the website
-- ("show_online": true/false on a product). Left out, the product keeps its current setting.
create or replace function public.import_products(products jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product jsonb;
  v_id uuid;
  v_count int := 0;
begin
  for v_product in select * from jsonb_array_elements(products) loop
    v_id := public.save_product(v_product);
    if v_product ? 'show_online' then
      update public.products set show_online = (v_product ->> 'show_online')::boolean where id = v_id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
