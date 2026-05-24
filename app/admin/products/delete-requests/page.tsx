import Link from "next/link";
import { ProductRequestsTable } from "@/components/admin/ProductRequestsTable";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDeleteRequestsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_change_requests")
    .select("*, vendor_products(id,title,sku,category,product_type,shopify_product_id,shopify_status), vendors(company_name)")
    .eq("request_type", "delete")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <DashboardShell role="admin" title="Delete Requests">
      <ProductTabs active="delete" />
      <ProductRequestsTable requests={(data ?? []) as any} type="delete" />
    </DashboardShell>
  );
}

function ProductTabs({ active }: { active: string }) {
  const tabs = [
    ["/admin/products", "new", "New Products"],
    ["/admin/products/edit-requests", "edit", "Edit Requests"],
    ["/admin/products/delete-requests", "delete", "Delete Requests"],
    ["/admin/products?status=shopify_draft", "drafts", "Drafts Created"],
    ["/admin/products?status=all", "all", "All"]
  ];
  return <div className="mb-5 flex flex-wrap gap-2">{tabs.map(([href, value, label]) => <Link key={href} href={href} className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${active === value ? "bg-ink text-white" : "border border-line bg-white text-slate-700"}`}>{label}</Link>)}</div>;
}
