import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ShopifyTokenSetting } from "@/lib/shopify-oauth";
import { formatDate } from "@/lib/utils";

export default async function AdminSettingsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value, updated_at").eq("key", "shopify_access_token").maybeSingle();
  const connection = data?.value as ShopifyTokenSetting | null | undefined;
  const connected = Boolean(connection?.access_token && connection.shop);

  return (
    <DashboardShell role="admin" title="Settings">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Shopify connection</h2>
              <p className="mt-1 text-sm text-slate-500">Connect this portal to your Shopify Dev Dashboard app using OAuth. The Admin API token is stored server-side in Supabase.</p>
            </div>
            <span className={connected ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800"}>
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>

          <dl className="mt-6 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-slate-500">Connected shop</dt>
              <dd className="mt-1 font-medium">{connection?.shop ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Scope</dt>
              <dd className="mt-1 font-medium">{connection?.scope ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Installed at</dt>
              <dd className="mt-1 font-medium">{formatDate(connection?.installed_at)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Updated at</dt>
              <dd className="mt-1 font-medium">{formatDate(data?.updated_at)}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <Link href="/api/shopify/install" className="inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
              {connected ? "Reconnect Shopify" : "Connect Shopify"}
            </Link>
          </div>
        </section>

        <aside className="rounded-lg border border-line bg-white p-5 text-sm text-slate-600">
          <h3 className="font-semibold text-ink">Fulfillment automation</h3>
          <p className="mt-2">Automatic fulfillment remains disabled unless <code>AUTO_FULFILLMENT_ENABLED=true</code>. Version 1 keeps tracking review manual.</p>
          <h3 className="mt-5 font-semibold text-ink">Required Shopify scopes</h3>
          <p className="mt-2">Stock sync requires <code>read_inventory</code>, <code>write_inventory</code>, and <code>read_locations</code>. If you change scopes in Shopify Dev Dashboard, release a new app version, then reconnect Shopify here.</p>
        </aside>
      </div>
    </DashboardShell>
  );
}
