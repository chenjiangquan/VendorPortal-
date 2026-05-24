import { DashboardShell } from "@/components/layout/DashboardShell";
import { ProductForm } from "@/components/products/ProductForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireVendor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function VendorProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { vendor } = await requireVendor();
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("vendor_products").select("*, product_images(*), product_variants(*)").eq("id", id).eq("vendor_id", vendor.id).single();
  const readOnly = !["draft", "rejected"].includes(product?.status);
  return (
    <DashboardShell role="vendor" title={product?.title ?? "Product"}>
      <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-white p-4"><span className="text-sm text-slate-500">Submitted products are read-only until admin review.</span><StatusBadge status={product?.status} /></div>
      <ProductForm product={product} mode="edit" readOnly={readOnly} />
    </DashboardShell>
  );
}
