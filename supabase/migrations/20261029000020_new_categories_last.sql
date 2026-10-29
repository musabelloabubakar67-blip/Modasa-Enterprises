-- New categories go to the end of the list, so they don't jump ahead of the order the owner set for the
-- website menu (Products → Categories & units). Covers every way one is added: the Categories page, a
-- new category typed on a product, and the workbook import.

create function public.categories_append()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sort_order = 0 then
    new.sort_order := coalesce((select max(sort_order) from public.categories), 0) + 10;
  end if;
  return new;
end;
$$;

create trigger categories_append before insert on public.categories
  for each row execute function public.categories_append();

revoke execute on function public.categories_append() from public, anon, authenticated;
