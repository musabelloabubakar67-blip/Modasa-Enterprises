-- Managers and owners may delete a category or unit, from Products → Categories & units. Only unused ones
-- can go: products.category_id and products.unit_id reference them, so the database refuses to delete one
-- that any product (archived ones included) still uses.

create policy "Managers delete categories" on public.categories for delete to authenticated
  using ((select public.is_manager_or_owner()));
create policy "Managers delete units" on public.units for delete to authenticated
  using ((select public.is_manager_or_owner()));
