alter table public.vendor_products
add column if not exists shopify_inventory_item_gid text;

alter table public.vendor_products
add column if not exists category_id text;

alter table public.vendor_products
add column if not exists shopify_category_id text;

alter table public.product_variants
add column if not exists shopify_inventory_item_gid text;
