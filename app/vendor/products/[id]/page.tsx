import { DashboardShell } from "@/components/layout/DashboardShell";
import { ProductChangeRequestActions } from "@/components/products/ProductChangeRequestActions";
import { ProductForm } from "@/components/products/ProductForm";
import { VendorProductDeleteButton } from "@/components/products/VendorProductDeleteButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
  const canDeleteLocally = ["draft", "rejected", "submitted"].includes(product.status);
  const isEditRequest = canRequestChanges && request === "edit" && !hasPendingEdit;
  const readOnly = isEditRequest ? false : !["draft", "rejected"].includes(product?.status);
  return (
    <DashboardShell role="vendor" title={isEditRequest ? `Request update: ${product?.title}` : product?.title ?? "Product"}>
      <Link href="/vendor/products" className="mb-4 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-panel hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        <TranslatedText translationKey="product.backToProducts" fallback="Back to products" />
      </Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4">
        <span className="text-sm text-slate-500">
          {isEditRequest ? (
            <TranslatedText translationKey="product.editRequestModeHelp" fallback="Submit proposed changes for admin review. Shopify will not be updated until admin approves." />
          ) : readOnly ? (
            <TranslatedText translationKey="product.readOnlyAfterSubmission" fallback="This product is read-only after submission. You can still view all submitted information here." />
          ) : (
            <TranslatedText translationKey="product.draftRejectedEditableHelp" fallback="Draft and rejected products can be edited before submitting again." />
          )}
        </span>
        <div className="flex items-center gap-3">
          <StatusBadge status={product?.status} />
          {!isEditRequest && canDeleteLocally && <VendorProductDeleteButton productId={product.id} />}
        </div>
      </div>
      {canRequestChanges && !isEditRequest && <ProductChangeRequestActions productId={product.id} hasPendingEdit={hasPendingEdit} hasPendingDelete={hasPendingDelete} />}
      <ProductForm product={product} mode={isEditRequest ? "change-request" : "edit"} readOnly={readOnly} />
    </DashboardShell>
  );
}
