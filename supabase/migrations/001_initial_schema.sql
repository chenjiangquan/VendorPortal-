create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','vendor')),
  full_name text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  company_name text not null,
  contact_name text,
  email text not null,
  phone text,
  website text,
  country text default 'United Kingdom',
  city text,
  address text,
  postcode text,
  business_type text,
  shopify_vendor_name text,
  commission_rate numeric default 0,
  status text not null check (status in ('active','suspended','archived')) default 'active',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.vendor_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  title text not null,
  handle text,
  description text,
  ai_description text,
  final_description text,
  product_type text,
  category text,
  tags text[],
  price numeric not null,
  compare_at_price numeric,
  cost_price numeric,
  sku text,
  barcode text,
  stock integer default 0,
  material text,
  colour text,
  dimensions text,
  weight text,
  lead_time text,
  shipping_note text,
  care_instruction text,
  status text not null check (status in ('draft','submitted','approved','rejected','shopify_draft','archived')) default 'draft',
  rejection_reason text,
  shopify_product_id text,
  shopify_product_gid text,
  shopify_variant_id text,
  shopify_variant_gid text,
  shopify_status text,
  seo_title text,
  seo_description text,
  google_product_category text,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  shopify_created_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.vendor_products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  url text not null,
  storage_path text,
  alt_text text,
  position integer default 0,
  created_at timestamptz default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.vendor_products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  option1_name text default 'Title',
  option1_value text default 'Default Title',
  option2_name text,
  option2_value text,
  option3_name text,
  option3_value text,
  sku text,
  price numeric,
  compare_at_price numeric,
  stock integer default 0,
  shopify_variant_id text,
  shopify_variant_gid text,
  created_at timestamptz default now()
);

create table public.vendor_orders (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  shopify_order_id text not null,
  shopify_order_gid text,
  shopify_order_name text,
  customer_name text,
  customer_email text,
  shipping_address jsonb,
  billing_address jsonb,
  total_price numeric,
  vendor_subtotal numeric,
  commission_rate numeric default 0,
  commission_amount numeric default 0,
  payout_amount numeric default 0,
  currency text default 'GBP',
  financial_status text,
  fulfillment_status text,
  status text not null check (status in ('open','tracking_submitted','reviewed','closed','cancelled')) default 'open',
  ordered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(shopify_order_id, vendor_id)
);

create table public.vendor_order_items (
  id uuid primary key default gen_random_uuid(),
  vendor_order_id uuid not null references public.vendor_orders(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  shopify_line_item_id text,
  shopify_product_id text,
  shopify_product_gid text,
  shopify_variant_id text,
  shopify_variant_gid text,
  title text,
  sku text,
  quantity integer,
  price numeric,
  total numeric,
  created_at timestamptz default now()
);

create table public.tracking_submissions (
  id uuid primary key default gen_random_uuid(),
  vendor_order_id uuid not null references public.vendor_orders(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  carrier text not null,
  tracking_number text not null,
  tracking_url text,
  note text,
  status text not null check (status in ('submitted','reviewed','rejected')) default 'submitted',
  admin_note text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  vendor_id uuid references public.vendors(id),
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

create index vendor_products_vendor_status_idx on public.vendor_products(vendor_id, status);
create index product_images_product_idx on public.product_images(product_id);
create index vendor_orders_vendor_status_idx on public.vendor_orders(vendor_id, status);
create index tracking_vendor_status_idx on public.tracking_submissions(vendor_id, status);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger vendors_updated_at before update on public.vendors for each row execute function public.set_updated_at();
create trigger vendor_products_updated_at before update on public.vendor_products for each row execute function public.set_updated_at();
create trigger vendor_orders_updated_at before update on public.vendor_orders for each row execute function public.set_updated_at();
