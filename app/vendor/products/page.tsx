import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { VendorProductsTable } from "@/components/products/VendorProductsTable";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function VendorProductsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { vendor } = await requireVendor();
  const { status } = await searchParams;
  const activeStatus = status ?? "active";
  const supabase = await createClient();
  let query = supabase.from("vendor_products").select("*").eq("vendor_id", vendor.id).order("created_at", { ascending: false });
  if (["active", "update_pending", "delete_pending"].includes(activeStatus)) query = query.neq("status", "archived");
  if (["draft", "submitted", "approved", "rejected", "shopify_draft", "archived"].includes(activeStatus)) query = query.eq("status", activeStatus);
  const { data } = await query;
  const baseProducts = data ?? [];
  const productIds = baseProducts.map((product) => product.id);
  const { data: changeRequests } = productIds.length
    ? await supabase
        .from("product_change_requests")
        .select("product_id,request_type,status")
        .eq("vendor_id", vendor.id)
        .eq("status", "pending")
        .in("product_id", productIds)
    : { data: [] };
  const requestsByProduct = new Map<string, { request_type: string; status: string }[]>();
  for (const request of changeRequests ?? []) {
    const current = requestsByProduct.get(request.product_id) ?? [];
    current.push({ request_type: request.request_type, status: request.status });
    requestsByProduct.set(request.product_id, current);
  }
  const products = baseProducts.map((product) => ({
    ...product,
    product_change_requests: requestsByProduct.get(product.id) ?? []
  }));
  return (
    <DashboardShell role="vendor" title="Products">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            ["active", "All"],
            ["draft", "Draft"],
            ["submitted", "Submitted"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
            ["shopify_draft", "Shopify Draft Created"],
            ["update_pending", "Update Pending"],
            ["delete_pending", "Delete Pending"],
            ["archived", "Archived"]
          ].map(([value, label]) => (
            <Link key={value} href={value === "active" ? "/vendor/products" : `/vendor/products?status=${value}`} className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeStatus === value ? "bg-ink text-white" : "border border-line bg-white text-slate-700"}`}>{label}</Link>
          ))}
        </div>
        <Link href="/vendor/products/new" className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm">Add Product</Link>
      </div>
      <VendorProductsTable products={products as any} requestFilter={activeStatus === "update_pending" ? "edit" : activeStatus === "delete_pending" ? "delete" : undefined} />
    </DashboardShell>
  );
}
