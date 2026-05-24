import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/ui/StatCard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [vendors, products, orders, tracking] = await Promise.all([
    supabase.from("vendors").select("id", { count: "exact", head: true }),
    supabase.from("vendor_products").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("vendor_orders").select("id", { count: "exact", head: true }),
    supabase.from("tracking_submissions").select("id", { count: "exact", head: true }).eq("status", "submitted")
  ]);

  return (
    <DashboardShell role="admin" title="Admin Dashboard">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Vendors" value={vendors.count ?? 0} />
        <StatCard label="Products to review" value={products.count ?? 0} tone="amber" />
        <StatCard label="Vendor orders" value={orders.count ?? 0} />
        <StatCard label="Tracking to review" value={tracking.count ?? 0} tone="green" />
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Workflow</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm" href="/admin/vendors/new">Create vendor</Link>
          <Link className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm" href="/admin/products">Review products</Link>
          <Link className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm" href="/admin/orders">Sync orders</Link>
          <Link className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm" href="/admin/tracking">Review tracking</Link>
        </div>
      </div>
    </DashboardShell>
  );
}
