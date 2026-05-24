-- Demo seed data. Replace UUIDs with real auth.users/profile ids before running in a live project.
-- To create the first admin, create a Supabase auth user, then run:
-- insert into public.profiles (id, role, full_name, email) values ('AUTH_USER_ID', 'admin', 'Platform Admin', 'admin@example.test')
-- on conflict (id) do update set role = 'admin';

insert into public.vendors (id, company_name, contact_name, email, shopify_vendor_name, commission_rate, notes)
values ('11111111-1111-1111-1111-111111111111', 'Demo Furniture Co', 'Demo Contact', 'vendor@example.test', 'Demo Furniture Co', 12.5, 'Demo vendor only')
on conflict (id) do nothing;

insert into public.vendor_products (id, vendor_id, title, description, product_type, category, tags, price, sku, stock, material, colour, dimensions, status)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Demo Oak Dining Chair', 'A simple demo dining chair for portal testing.', 'Chair', 'Dining Room', array['oak','chair'], 129.00, 'DEMO-CHAIR', 8, 'Oak', 'Natural', 'Please refer to the product images or contact us for details.', 'submitted')
on conflict (id) do nothing;

insert into public.vendor_orders (id, vendor_id, shopify_order_id, shopify_order_name, customer_name, shipping_address, vendor_subtotal, commission_rate, commission_amount, payout_amount, currency, status, ordered_at)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '1000001', '#1001', 'Demo Customer', '{"name":"Demo Customer","address1":"1 Demo Street","city":"London","country":"United Kingdom","zip":"SW1A 1AA"}', 129.00, 12.5, 16.13, 112.87, 'GBP', 'tracking_submitted', now())
on conflict (shopify_order_id, vendor_id) do nothing;

insert into public.vendor_order_items (vendor_order_id, vendor_id, title, sku, quantity, price, total)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Demo Oak Dining Chair', 'DEMO-CHAIR', 1, 129.00, 129.00);

insert into public.tracking_submissions (vendor_order_id, vendor_id, carrier, tracking_number, tracking_url, note, status)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Demo Carrier', 'DEMO123', 'https://example.test/tracking/DEMO123', 'Demo tracking submission', 'submitted');
