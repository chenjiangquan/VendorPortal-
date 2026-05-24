import Image from "next/image";
import { ProductRequestReviewPanel } from "@/components/admin/ProductRequestReviewPanel";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, shopifyAdminProductUrl } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function AdminDeleteRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("product_change_requests")
    .select("*, vendor_products(*, vendors(*), product_images(*), product_variants(*))")
    .eq("id", id)
    .eq("request_type", "delete")
    .single();
  if (!request) notFound();
  const product = request.vendor_products;
  const adminUrl = shopifyAdminProductUrl(product?.shopify_product_gid);

  return (
    <DashboardShell role="admin" title="Delete Request">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-xl font-semibold">{product?.title}</h2><p className="text-sm text-slate-500">{product?.vendors?.company_name}</p></div>
            <StatusBadge status={request.status} />
          </div>
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{request.reason}</p>
          {adminUrl && <a href={adminUrl} className="mt-4 inline-flex rounded-xl border border-line px-4 py-2 text-sm font-semibold">Open Shopify Draft</a>}
          <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
            <div><dt className="text-slate-500">Price</dt><dd>{formatCurrency(product?.price)}</dd></div>
            <div><dt className="text-slate-500">SKU</dt><dd>{product?.sku}</dd></div>
            <div><dt className="text-slate-500">Stock</dt><dd>{product?.stock}</dd></div>
            <div><dt className="text-slate-500">Shopify ID</dt><dd>{product?.shopify_product_id}</dd></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{(product?.product_images ?? []).map((image: any) => <div key={image.id} className="relative aspect-square overflow-hidden rounded-md border border-line bg-panel"><Image src={image.url} alt={image.alt_text ?? product.title} fill className="object-cover" /></div>)}</div>
        </section>
        <ProductRequestReviewPanel requestId={request.id} type="delete" />
      </div>
    </DashboardShell>
  );
}
