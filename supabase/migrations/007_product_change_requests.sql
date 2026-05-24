create table if not exists public.product_change_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.vendor_products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  request_type text not null check (request_type in ('edit', 'delete')),
  status text not null check (status in ('pending', 'approved', 'rejected', 'cancelled')) default 'pending',
  proposed_data jsonb,
  reason text,
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists product_change_requests_product_id_idx on public.product_change_requests(product_id);
create index if not exists product_change_requests_vendor_id_idx on public.product_change_requests(vendor_id);
create index if not exists product_change_requests_status_idx on public.product_change_requests(status);
create index if not exists product_change_requests_request_type_idx on public.product_change_requests(request_type);

alter table public.product_change_requests enable row level security;

drop policy if exists "admin all product change requests" on public.product_change_requests;
drop policy if exists "vendor read own product change requests" on public.product_change_requests;
drop policy if exists "vendor insert own product change requests" on public.product_change_requests;
drop policy if exists "vendor cancel own pending product change requests" on public.product_change_requests;

create policy "admin all product change requests"
on public.product_change_requests
for all
using (public.is_admin())
with check (public.is_admin());

create policy "vendor read own product change requests"
on public.product_change_requests
for select
using (vendor_id = public.current_vendor_id());

create policy "vendor insert own product change requests"
on public.product_change_requests
for insert
with check (
  vendor_id = public.current_vendor_id()
  and exists (
    select 1 from public.vendor_products
    where vendor_products.id = product_change_requests.product_id
    and vendor_products.vendor_id = public.current_vendor_id()
  )
);

create policy "vendor cancel own pending product change requests"
on public.product_change_requests
for update
using (vendor_id = public.current_vendor_id() and status = 'pending')
with check (vendor_id = public.current_vendor_id() and status = 'cancelled');

notify pgrst, 'reload schema';
