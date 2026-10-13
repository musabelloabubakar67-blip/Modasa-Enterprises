-- Faster row-level security: the same rules, checked once per query instead of once per row.
--
-- The helpers (current_staff_role and friends) look the caller up in profiles. Called bare in a policy,
-- Postgres runs that lookup for every row it reads, so a report over 20,000 sales did 20,000 profile
-- lookups. Wrapped in (select ...), it runs once per query and the result is reused. Who can see or
-- change what is unchanged.
--
-- Policies whose only check is "the parent row is visible" (sale_lines, transfer_lines, ...) need no
-- change: they speed up with their parent table's policy. The storage.objects policies are left as they
-- are; that table belongs to Supabase's storage service and holds only a few product images.

-- ---------- Foundation ----------

alter policy "Active staff can read business settings" on public.business_settings
  using ((select public.current_staff_role()) is not null);
alter policy "Owner can update business settings" on public.business_settings
  using ((select public.is_owner())) with check ((select public.is_owner()));

alter policy "Active staff can read locations" on public.locations
  using ((select public.current_staff_role()) is not null);
alter policy "Owner can add locations" on public.locations
  with check ((select public.is_owner()));
alter policy "Owner can update locations" on public.locations
  using ((select public.is_owner())) with check ((select public.is_owner()));

alter policy "Staff can read own profile; owner and managers read all" on public.profiles
  using (id = (select auth.uid()) or (select public.current_staff_role()) in ('owner', 'manager'));
alter policy "Owner can update profiles" on public.profiles
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- ---------- Products ----------

alter policy "Staff read categories" on public.categories
  using ((select public.current_staff_role()) is not null);
alter policy "Managers add categories" on public.categories
  with check ((select public.is_manager_or_owner()));
alter policy "Managers edit categories" on public.categories
  using ((select public.is_manager_or_owner())) with check ((select public.is_manager_or_owner()));

alter policy "Staff read units" on public.units
  using ((select public.current_staff_role()) is not null);
alter policy "Managers add units" on public.units
  with check ((select public.is_manager_or_owner()));
alter policy "Managers edit units" on public.units
  using ((select public.is_manager_or_owner())) with check ((select public.is_manager_or_owner()));

alter policy "Staff read products" on public.products
  using ((select public.current_staff_role()) is not null);
alter policy "Managers add products" on public.products
  with check ((select public.is_manager_or_owner()));
alter policy "Managers edit products" on public.products
  using ((select public.is_manager_or_owner())) with check ((select public.is_manager_or_owner()));

alter policy "Staff read SKUs" on public.skus
  using ((select public.current_staff_role()) is not null);
alter policy "Managers add SKUs" on public.skus
  with check ((select public.is_manager_or_owner()));
alter policy "Managers edit SKUs" on public.skus
  using ((select public.is_manager_or_owner())) with check ((select public.is_manager_or_owner()));

alter policy "Managers manage costs" on public.sku_costs
  using ((select public.is_manager_or_owner())) with check ((select public.is_manager_or_owner()));

alter policy "Staff read product images" on public.product_images
  using ((select public.current_staff_role()) is not null);
alter policy "Managers add product images" on public.product_images
  with check ((select public.is_manager_or_owner()));
alter policy "Managers edit product images" on public.product_images
  using ((select public.is_manager_or_owner())) with check ((select public.is_manager_or_owner()));
alter policy "Managers delete product images" on public.product_images
  using ((select public.is_manager_or_owner()));

-- ---------- Stock ----------

alter policy "Staff read stock levels" on public.stock_levels
  using ((select public.current_staff_role()) is not null);
alter policy "Staff read stock movements" on public.stock_movements
  using ((select public.current_staff_role()) is not null);
alter policy "Staff read reorder levels" on public.reorder_levels
  using ((select public.current_staff_role()) is not null);
alter policy "Staff read stock holds" on public.stock_holds
  using ((select public.current_staff_role()) is not null);

alter policy "Staff read adjustments" on public.adjustments
  using ((select public.is_manager_or_owner()) or location_id = (select public.current_staff_location()));

alter policy "Managers and warehouse staff read deliveries" on public.receipts
  using (
    (select public.is_manager_or_owner())
    or ((select public.current_staff_role()) = 'warehouse' and location_id = (select public.current_staff_location()))
  );
alter policy "Managers read delivery costs" on public.receipt_costs
  using ((select public.is_manager_or_owner()));

-- ---------- Transfers ----------

alter policy "Staff read relevant transfers" on public.transfers
  using (
    (select public.is_manager_or_owner())
    or (select public.current_staff_location()) in (from_location_id, to_location_id)
    or ((select public.current_staff_role()) is not null and status = 'dispatched')
  );

-- ---------- Sales ----------

alter policy "Staff read sales at their shop" on public.sales
  using ((select public.is_manager_or_owner()) or location_id = (select public.current_staff_location()));
alter policy "Staff read returns at their shop" on public.returns
  using ((select public.is_manager_or_owner()) or location_id = (select public.current_staff_location()));
alter policy "Staff read shifts at their shop" on public.shifts
  using ((select public.is_manager_or_owner()) or location_id = (select public.current_staff_location()));
alter policy "Staff read drawer openings at their shop" on public.drawer_openings
  using ((select public.is_manager_or_owner()) or location_id = (select public.current_staff_location()));
alter policy "Till staff read customers" on public.customers
  using ((select public.current_staff_role()) in ('owner', 'manager', 'cashier'));
alter policy "Managers read sale costs" on public.sale_line_costs
  using ((select public.is_manager_or_owner()));

-- ---------- Online shop ----------

alter policy "Staff read delivery areas" on public.delivery_areas
  using ((select public.current_staff_role()) is not null);
alter policy "Managers add delivery areas" on public.delivery_areas
  with check ((select public.is_manager_or_owner()));
alter policy "Managers edit delivery areas" on public.delivery_areas
  using ((select public.is_manager_or_owner())) with check ((select public.is_manager_or_owner()));

alter policy "Till staff read online orders for their shop" on public.online_orders
  using (
    (select public.is_manager_or_owner())
    or ((select public.current_staff_role()) = 'cashier' and location_id = (select public.current_staff_location()))
  );
