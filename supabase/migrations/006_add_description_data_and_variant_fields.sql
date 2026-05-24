alter table public.vendor_products
add column if not exists description_data jsonb;

alter table public.vendor_products
add column if not exists has_variants boolean default false;

alter table public.vendor_products
add column if not exists options jsonb;

alter table public.product_variants
add column if not exists barcode text;
