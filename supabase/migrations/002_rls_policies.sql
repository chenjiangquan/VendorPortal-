create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.vendors where user_id = auth.uid() and status = 'active' limit 1;
$$;

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.vendor_orders enable row level security;
alter table public.vendor_order_items enable row level security;
alter table public.tracking_submissions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.app_settings enable row level security;

create policy "admin all profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "own profile read" on public.profiles for select using (id = auth.uid());
create policy "own profile limited update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "admin all vendors" on public.vendors for all using (public.is_admin()) with check (public.is_admin());
create policy "vendor own vendor read" on public.vendors for select using (id = public.current_vendor_id());
create policy "vendor own vendor limited update" on public.vendors for update using (id = public.current_vendor_id()) with check (id = public.current_vendor_id());

create policy "admin all products" on public.vendor_products for all using (public.is_admin()) with check (public.is_admin());
create policy "vendor read own products" on public.vendor_products for select using (vendor_id = public.current_vendor_id());
create policy "vendor insert own draft products" on public.vendor_products for insert with check (vendor_id = public.current_vendor_id() and status in ('draft','submitted'));
create policy "vendor update draft rejected submitted own products" on public.vendor_products
  for update using (vendor_id = public.current_vendor_id() and status in ('draft','rejected'))
  with check (vendor_id = public.current_vendor_id() and status in ('draft','rejected','submitted'));

create policy "admin all images" on public.product_images for all using (public.is_admin()) with check (public.is_admin());
create policy "vendor read own images" on public.product_images for select using (vendor_id = public.current_vendor_id());
create policy "vendor insert own draft images" on public.product_images for insert with check (
  vendor_id = public.current_vendor_id()
  and exists(select 1 from public.vendor_products p where p.id = product_id and p.vendor_id = public.current_vendor_id() and p.status in ('draft','rejected'))
);
create policy "vendor delete own draft images" on public.product_images for delete using (
  vendor_id = public.current_vendor_id()
  and exists(select 1 from public.vendor_products p where p.id = product_id and p.vendor_id = public.current_vendor_id() and p.status in ('draft','rejected'))
);

create policy "admin all variants" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());
create policy "vendor read own variants" on public.product_variants for select using (vendor_id = public.current_vendor_id());
create policy "vendor write own draft variants" on public.product_variants for all using (vendor_id = public.current_vendor_id()) with check (vendor_id = public.current_vendor_id());

create policy "admin all orders" on public.vendor_orders for all using (public.is_admin()) with check (public.is_admin());
create policy "vendor read own orders" on public.vendor_orders for select using (vendor_id = public.current_vendor_id());

create policy "admin all order items" on public.vendor_order_items for all using (public.is_admin()) with check (public.is_admin());
create policy "vendor read own order items" on public.vendor_order_items for select using (vendor_id = public.current_vendor_id());

create policy "admin all tracking" on public.tracking_submissions for all using (public.is_admin()) with check (public.is_admin());
create policy "vendor read own tracking" on public.tracking_submissions for select using (vendor_id = public.current_vendor_id());
create policy "vendor insert own tracking" on public.tracking_submissions for insert with check (
  vendor_id = public.current_vendor_id()
  and exists(select 1 from public.vendor_orders o where o.id = vendor_order_id and o.vendor_id = public.current_vendor_id())
);

create policy "admin all activity" on public.activity_logs for all using (public.is_admin()) with check (public.is_admin());
create policy "vendor read own activity" on public.activity_logs for select using (vendor_id = public.current_vendor_id());
create policy "users insert activity" on public.activity_logs for insert with check (user_id = auth.uid() or public.is_admin());

create policy "admin all settings" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());
