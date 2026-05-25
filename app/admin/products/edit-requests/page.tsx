import Link from "next/link";
import { ProductRequestsTable } from "@/components/admin/ProductRequestsTable";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Pagination } from "@/components/ui/Pagination";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminEditRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string; limit?: string }> }) {
  await requireRole("admin");
  const { page: rawPage, limit: rawLimit } = await searchParams;
  const page = Math.max(1, Number(rawPage ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(rawLimit ?? 20) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("product_change_requests")
    .select("id,request_type,status,reason,created_at,vendor_products(id,title,sku,category,product_type,shopify_product_id,shopify_status), vendors(company_name)", { count: "exact" })
    .eq("request_type", "edit")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <DashboardShell role="admin" title="Edit Requests">
      <ProductTabs active="edit" />
      <ProductRequestsTable requests={(data ?? []) as any} type="edit" />
      <Pagination page={page} limit={limit} total={count ?? 0} basePath="/admin/products/edit-requests" />
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
  return <div className="mb-5 flex flex-wrap gap-2">{tabs.map(([href, value, label]) => <Link key={href} href={href} prefetch={true} className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${active === value ? "bg-ink text-white" : "border border-line bg-white text-slate-700"}`}>{label}</Link>)}</div>;
}
