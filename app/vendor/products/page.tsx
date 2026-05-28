import { DashboardShell } from "@/components/layout/DashboardShell";
import { VendorProductsHeader } from "@/components/products/VendorProductsHeader";
import { VendorProductsTable } from "@/components/products/VendorProductsTable";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function VendorProductsPage({ searchParams }: { searchParams: Promise<{ status?: string; sort?: string; direction?: string }> }) {
  const { vendor } = await requireVendor();
  const { status, sort, direction } = await searchParams;
  const activeStatus = status ?? "active";
  const safeSort = ["title", "created_at", "price", "stock", "status"].includes(sort ?? "") ? String(sort) : "created_at";
  const safeDirection = direction === "asc" ? "asc" : "desc";
  const supabase = await createClient();
  let query = supabase.from("vendor_products").select("*, product_variants(price)").eq("vendor_id", vendor.id).order(safeSort, { ascending: safeDirection === "asc" });
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
      <VendorProductsHeader activeStatus={activeStatus} sort={sort} direction={direction} />
      <VendorProductsTable products={products as any} status={activeStatus} sort={sort} direction={direction} requestFilter={activeStatus === "update_pending" ? "edit" : activeStatus === "delete_pending" ? "delete" : undefined} />
    </DashboardShell>
  );
}
