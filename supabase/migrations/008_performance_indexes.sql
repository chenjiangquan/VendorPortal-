create index if not exists idx_vendor_products_status on public.vendor_products(status);
create index if not exists idx_vendor_products_vendor_id on public.vendor_products(vendor_id);
create index if not exists idx_vendor_products_created_at on public.vendor_products(created_at desc);
create index if not exists idx_vendor_products_shopify_product_gid on public.vendor_products(shopify_product_gid);

create index if not exists idx_product_change_requests_status on public.product_change_requests(status);
create index if not exists idx_product_change_requests_request_type on public.product_change_requests(request_type);
create index if not exists idx_product_change_requests_created_at on public.product_change_requests(created_at desc);
create index if not exists idx_product_change_requests_vendor_id on public.product_change_requests(vendor_id);
