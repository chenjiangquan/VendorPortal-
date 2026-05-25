alter table public.vendor_products
alter column price drop not null;

alter table public.vendor_products
alter column stock drop not null;
