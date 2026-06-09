# Shopify Furniture Vendor Portal

Independent Vendor Portal for a Shopify furniture store. This is not a marketplace app and does not allow public vendor registration. Platform admins manually create vendor accounts, vendors upload products, admins review them, and submitted products can be created in Shopify as `DRAFT` products through the Admin GraphQL API.

## Tech Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, Storage, RLS
- Shopify Admin GraphQL API
- Vercel target hosting
- zod validation and Sonner toast notifications

## Environment

Copy `.env.local.example` to `.env.local` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SHOPIFY_STORE_DOMAIN=
SHOPIFY_API_VERSION=2026-04
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_SCOPES=read_orders,read_products,write_products,read_inventory,write_inventory,read_locations
SHOPIFY_APP_URL=
OPENAI_API_KEY=
APP_URL=
```

`SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_CLIENT_SECRET`, and `OPENAI_API_KEY` are server-only. Do not expose them with `NEXT_PUBLIC_`. Shopify Admin API access tokens are acquired through OAuth and stored in Supabase `app_settings`, not in `.env.local`.

Never commit `.env.local`. It is listed in `.gitignore` and should stay local to each development or deployment environment.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login`.

## Supabase Setup

Run migrations in order:

```bash
supabase db push
```

The migrations create all portal tables, RLS policies, helper functions `is_admin()` and `current_vendor_id()`, and the public `product-images` storage bucket.

If Supabase returns a schema cache error such as `Could not find the 'description_data' column of 'vendor_products' in the schema cache`, run the latest migrations in the Supabase SQL Editor or with `supabase db push`. After executing `alter table` statements, Supabase may need a short time to refresh its API schema cache; wait a few seconds and refresh the app if the error persists.

Product update/delete requests require the `product_change_requests` table. After adding or changing migrations, run them in Supabase SQL Editor or with Supabase CLI before testing the portal. If Supabase still reports `Could not find the table 'public.product_change_requests' in the schema cache`, wait 30-60 seconds after running the migration and retry.

For forgot/reset password, configure Supabase Auth URL settings with these redirect URLs:

```text
Local: http://localhost:3000/reset-password
Production: https://vendors.directsourcehome.com/reset-password
```

Forgot/reset password uses Supabase Auth reset links. In local development the browser origin is used for the reset redirect; in production, configure Supabase Auth with the production redirect URL above.

## Create First Admin

Create a user in Supabase Auth, then promote it:

```sql
insert into public.profiles (id, role, full_name, email)
values ('AUTH_USER_ID', 'admin', 'Platform Admin', 'admin@example.test')
on conflict (id) do update set role = 'admin';
```

After that user logs in, they can create vendor accounts from `/admin/vendors/new`.

## Vendor Account Flow

1. Admin opens `/admin/vendors/new`.
2. Admin enters company, contact, email, and temporary password.
3. Server-side API uses Supabase admin auth to create the user.
4. The page displays copyable login URL, email, and temporary password.
5. Vendor logs in and can change password at `/vendor/change-password`.

There is no `/register` page.

## Shopify Setup

Create an app in the Shopify Dev Dashboard and copy the Client ID and Client Secret into `.env.local`.

Set requested scopes in `SHOPIFY_SCOPES`, for example:

- `write_products`
- `read_products`
- `read_orders`
- `read_inventory`
- `write_inventory`
- `read_locations`
- `write_fulfillments` optional future scope

Inventory sync uses Shopify Inventory Item, Inventory Level, and Location APIs, so `read_inventory`, `write_inventory`, and `read_locations` are required if you want Vendor Portal stock values to sync into Shopify. After changing scopes in the Shopify Dev Dashboard, release the new app version and reconnect Shopify from `/admin/settings`.

In the Shopify Dev Dashboard, add this Allowed redirection URL for local development:

```text
http://localhost:3000/api/shopify/callback
```

For production, add your deployed callback too:

```text
https://vendors.directsourcehome.com/api/shopify/callback
```

If Shopify does not accept a localhost callback for your app setup, expose your local server with ngrok or cloudflared. Use that public HTTPS URL for both `SHOPIFY_APP_URL` and the Dev Dashboard allowed redirection URL, for example:

```bash
SHOPIFY_APP_URL=https://your-tunnel.ngrok-free.app
```

After environment variables are configured, log in as admin and open `/admin/settings`. Click `Connect Shopify` to start the OAuth installation flow. On success, the callback stores this server-side setting:

```text
app_settings.key = shopify_access_token
```

The setting value contains `shop`, `access_token`, `scope`, and `installed_at`. The access token is never exposed to the browser.

Product creation is server-side only through `lib/shopify.ts`. Products are always created with `status: DRAFT`, include vendor portal metafields, and are idempotent if `shopify_product_gid` already exists. Shopify GraphQL requests read the saved OAuth token from Supabase `app_settings`.

Admin product review uses a direct flow: vendor submits product, then admin either creates a Shopify Draft or rejects the product with a reason. The old `approved` status may remain in the database for compatibility, but the v1 admin UI does not require an approval step.

### Product Change Requests

New Product:

Vendor creates product -> Submit -> Admin creates Shopify Draft -> Product disappears from the New Products queue and remains visible in Vendor Products and Admin history.

Edit Existing Shopify Draft:

Vendor opens a Shopify Draft product -> requests an update -> proposed changes are stored in `product_change_requests` -> Admin reviews the comparison -> Admin approves -> Vendor Portal updates the local product and calls Shopify `productUpdate`. Vendor cannot directly modify Shopify.

Delete Existing Shopify Draft:

Vendor opens a Shopify Draft product -> requests delete with a reason -> Admin reviews -> Admin approves -> Shopify product is archived and the local product is marked `archived`. Vendor cannot directly delete Shopify products.

Admin controls all final Shopify updates. Variants remain saved in Vendor Portal; complex Shopify variant synchronisation is intentionally deferred and should be reviewed manually in Shopify when needed.

## Test Workflow

1. Log in as admin.
2. Create vendor.
3. Log in as vendor.
4. Create product draft.
5. Upload product images.
6. Submit product to admin.
7. Admin creates a Shopify Draft or rejects the product.
8. If rejected, vendor edits and resubmits.
9. Admin opens `/admin/settings` and clicks `Connect Shopify` if the app is not connected.
10. Admin syncs latest Shopify orders from `/admin/orders`.
11. Vendor opens an order and submits carrier/tracking details.
12. Admin reviews tracking from `/admin/tracking`.

## Fulfillment Behaviour

Version 1 does not automatically fulfill Shopify orders. Tracking submissions stay in the portal for admin review. After marking tracking reviewed, the admin should manually fulfill the Shopify order in Shopify Admin.

`createShopifyFulfillmentFromTracking(trackingSubmissionId)` exists as a disabled future hook and only runs if `AUTO_FULFILLMENT_ENABLED=true`; it intentionally throws until fulfillment-order logic is implemented.

## Deployment to Vercel

1. Push the project to GitHub.
2. Import the GitHub repo into Vercel.
3. Add the Vercel environment variables listed below.
4. Add the custom domain `vendors.directsourcehome.com` in Vercel.
5. Update the Shopify Dev Dashboard App URL to `https://vendors.directsourcehome.com`.
6. Update Shopify allowed redirection URLs:

```text
https://vendors.directsourcehome.com/api/shopify/callback
```

7. Update Supabase Auth URL Configuration:

```text
Site URL: https://vendors.directsourcehome.com
Redirect URLs:
http://localhost:3000/reset-password
https://vendors.directsourcehome.com/reset-password
```

8. Deploy.
9. Log in as admin and reconnect Shopify from `/admin/settings` after production deployment.

Production `APP_URL` and `SHOPIFY_APP_URL` must be `https://vendors.directsourcehome.com`. Do not use localhost URLs in Vercel production environment variables.

For best dashboard performance, keep the Vercel Function region close to the Supabase project region. For a UK/Europe operation, choose a Vercel region and Supabase region that are both in or near Europe to reduce round-trip latency for server-rendered admin pages.

### Vercel Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

SHOPIFY_STORE_DOMAIN=direct-source-home.myshopify.com
SHOPIFY_API_VERSION=2026-04
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_client_secret
SHOPIFY_SCOPES=read_orders,read_products,write_products,read_inventory,write_inventory,read_locations
SHOPIFY_APP_URL=https://vendors.directsourcehome.com

OPENAI_API_KEY=
APP_URL=https://vendors.directsourcehome.com
```

## Known Limitations

- Variant UI is intentionally minimal in v1, though schema and Shopify service support simple variants.
- Product image sorting and alt-text editing are scaffolded but not fully polished.
- AI optimisation returns structured output but the admin apply-flow is a next step.
- Order sync is manual rather than cron-based.
- Tracking review does not call Shopify fulfillment APIs.

## TODO

- Automatic Shopify fulfillment after admin review
- Payout and commission reporting
- Vendor inventory update flow
- Advanced variant editor
- Scheduled Shopify order sync
- Email notifications for vendor account creation and review results
