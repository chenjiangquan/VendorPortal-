import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { StatCard } from "@/components/ui/StatCard";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function VendorPage() {
  const { vendor } = await requireVendor();
  const supabase = await createClient();
  const [products, orders, tracking] = await Promise.all([
    supabase.from("vendor_products").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id).in("status", ["approved", "shopify_draft"]),
    supabase.from("vendor_orders").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id),
    supabase.from("tracking_submissions").select("id", { count: "exact", head: true }).eq("vendor_id", vendor.id)
  ]);

  return (
    <DashboardShell role="vendor" title={vendor.company_name}>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={<TranslatedText translationKey="nav.products" fallback="Products" />} value={products.count ?? 0} />
        <StatCard label={<TranslatedText translationKey="nav.orders" fallback="Orders" />} value={orders.count ?? 0} />
        <StatCard label={<TranslatedText translationKey="dashboard.trackingSubmissions" fallback="Tracking submissions" />} value={tracking.count ?? 0} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm" href="/vendor/products/new"><TranslatedText translationKey="product.addProduct" fallback="Add Product" /></Link>
        <Link className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm" href="/vendor/orders"><TranslatedText translationKey="dashboard.viewOrders" fallback="View Orders" /></Link>
      </div>
    </DashboardShell>
  );
}
