import { DashboardShell } from "@/components/layout/DashboardShell";
import { ProductChangeRequestActions } from "@/components/products/ProductChangeRequestActions";
import { ProductForm } from "@/components/products/ProductForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function VendorProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ request?: string }> }) {
  const { vendor } = await requireVendor();
  const { id } = await params;
  const { request } = await searchParams;
  const supabase = await createClient();
  const { data: product } = await supabase.from("vendor_products").select("*, product_images(*), product_variants(*)").eq("id", id).eq("vendor_id", vendor.id).single();
  if (!product) notFound();
  const { data: requests } = await supabase.from("product_change_requests").select("*").eq("product_id", id).eq("vendor_id", vendor.id).eq("status", "pending");
  const hasPendingEdit = (requests ?? []).some((item: any) => item.request_type === "edit");
  const hasPendingDelete = (requests ?? []).some((item: any) => item.request_type === "delete");
  const canRequestChanges = ["approved", "shopify_draft"].includes(product.status);
  const isEditRequest = canRequestChanges && request === "edit" && !hasPendingEdit;
  const readOnly = isEditRequest ? false : !["draft", "rejected"].includes(product?.status);
  return (
    <DashboardShell role="vendor" title={isEditRequest ? `Request update: ${product?.title}` : product?.title ?? "Product"}>
      <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-white p-4">
        <span className="text-sm text-slate-500">{isEditRequest ? "Submit proposed changes for admin review. Shopify will not be updated until admin approves." : readOnly ? "This product is read-only after submission. You can still view all submitted information here." : "Draft and rejected products can be edited before submitting again."}</span>
        <StatusBadge status={product?.status} />
      </div>
      {canRequestChanges && !isEditRequest && <ProductChangeRequestActions productId={product.id} hasPendingEdit={hasPendingEdit} hasPendingDelete={hasPendingDelete} />}
      <ProductForm product={product} mode={isEditRequest ? "change-request" : "edit"} readOnly={readOnly} />
    </DashboardShell>
  );
}
