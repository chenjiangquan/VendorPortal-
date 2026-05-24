import Link from "next/link";
import { AdminProductsTable } from "@/components/admin/AdminProductsTable";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const FILTERS = [
  { label: "New Products", value: "submitted" },
  { label: "Edit Requests", value: "edit_requests" },
  { label: "Delete Requests", value: "delete_requests" },
  { label: "Drafts Created", value: "shopify_draft" },
  { label: "All", value: "all" }
];

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("admin");
  const { status } = await searchParams;
  const activeStatus = status ?? "submitted";
  const supabase = await createClient();
  if (activeStatus === "edit_requests") {
    const { redirect } = await import("next/navigation");
    redirect("/admin/products/edit-requests");
  }
  if (activeStatus === "delete_requests") {
    const { redirect } = await import("next/navigation");
    redirect("/admin/products/delete-requests");
  }
  let query = supabase.from("vendor_products").select("*, vendors(company_name)").order("created_at", { ascending: false });
  if (activeStatus !== "all") {
    query = query.eq("status", activeStatus);
  }
  const { data } = await query;
  const products = data ?? [];
  return (
    <DashboardShell role="admin" title="Products">
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "submitted" ? "/admin/products" : filter.value === "edit_requests" ? "/admin/products/edit-requests" : filter.value === "delete_requests" ? "/admin/products/delete-requests" : `/admin/products?status=${filter.value}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${activeStatus === filter.value ? "bg-ink text-white" : "border border-line bg-white text-slate-700"}`}
          >
            {filter.label}
          </Link>
        ))}
      </div>
      <AdminProductsTable products={products as any} />
    </DashboardShell>
  );
}
