import Link from "next/link";
import { AdminProductsTable } from "@/components/admin/AdminProductsTable";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Pagination } from "@/components/ui/Pagination";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const FILTERS = [
  { label: "New Products", value: "submitted" },
  { label: "Edit Requests", value: "edit_requests" },
  { label: "Delete Requests", value: "delete_requests" },
  { label: "Drafts Created", value: "shopify_draft" },
  { label: "All", value: "all" }
];

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; limit?: string }> }) {
  await requireRole("admin");
  const { status, page: rawPage, limit: rawLimit } = await searchParams;
  const activeStatus = status ?? "submitted";
  const page = Math.max(1, Number(rawPage ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(rawLimit ?? 20) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const supabase = await createClient();
  if (activeStatus === "edit_requests") {
    const { redirect } = await import("next/navigation");
    redirect("/admin/products/edit-requests");
  }
  if (activeStatus === "delete_requests") {
    const { redirect } = await import("next/navigation");
    redirect("/admin/products/delete-requests");
  }
  let query = supabase
    .from("vendor_products")
    .select("id,title,status,vendor_id,price,stock,has_variants,category,product_type,created_at,sku,shopify_product_gid,shopify_product_id,vendors(company_name),product_variants(price)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (activeStatus !== "all") {
    query = query.eq("status", activeStatus);
  }
  if (activeStatus === "submitted") {
    query = query.is("shopify_product_gid", null);
  }
  const { data, count } = await query;
  const products = data ?? [];
  return (
    <DashboardShell role="admin" title="Products">
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "submitted" ? "/admin/products" : filter.value === "edit_requests" ? "/admin/products/edit-requests" : filter.value === "delete_requests" ? "/admin/products/delete-requests" : `/admin/products?status=${filter.value}`}
            prefetch={true}
            className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${activeStatus === filter.value ? "bg-ink text-white" : "border border-line bg-white text-slate-700"}`}
          >
            {filter.label}
          </Link>
        ))}
      </div>
      <AdminProductsTable products={products as any} />
      <Pagination page={page} limit={limit} total={count ?? 0} basePath="/admin/products" params={{ status: activeStatus === "submitted" ? undefined : activeStatus }} />
    </DashboardShell>
  );
}
