import Image from "next/image";
import { AdminProductReviewPanel } from "@/components/admin/AdminProductReviewPanel";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, shopifyAdminProductUrl } from "@/lib/utils";
import { normaliseDescriptionData } from "@/lib/product-description";

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("vendor_products").select("*, vendors(*), product_images(*), product_variants(*)").eq("id", id).single();
  const { data: latestShopifyLog } = await supabase
    .from("activity_logs")
    .select("metadata")
    .eq("entity_type", "vendor_products")
    .eq("entity_id", id)
    .eq("action", "shopify_draft_created")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const shopifyWarnings = Array.isArray((latestShopifyLog?.metadata as any)?.warnings) ? (latestShopifyLog?.metadata as any).warnings : [];
  const adminUrl = shopifyAdminProductUrl(product?.shopify_product_gid);
  const descriptionData = normaliseDescriptionData(product?.description_data);

  return (
    <DashboardShell role="admin" title={product?.title ?? "Product"}>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{product?.title}</h2><p className="text-sm text-slate-500">{product?.vendors?.company_name}</p></div><StatusBadge status={product?.status} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{(product?.product_images ?? []).map((image: any) => <div key={image.id} className="relative aspect-square overflow-hidden rounded-md border border-line bg-panel"><Image src={image.url} alt={image.alt_text ?? product.title} fill className="object-cover" /></div>)}</div>
          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3"><div><dt className="text-slate-500">Price</dt><dd>{formatCurrency(product?.price)}</dd></div><div><dt className="text-slate-500">SKU</dt><dd>{product?.sku}</dd></div><div><dt className="text-slate-500">Stock</dt><dd>{product?.stock}</dd></div><div><dt className="text-slate-500">Category</dt><dd>{product?.category}</dd></div><div><dt className="text-slate-500">Material</dt><dd>{product?.material}</dd></div><div><dt className="text-slate-500">Dimensions</dt><dd>{product?.dimensions}</dd></div></dl>
          <div className="mt-6 rounded-2xl border border-line bg-panel p-5">
            <h3 className="font-semibold">Structured Description Preview</h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Product Overview</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {descriptionData.overview.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
              <div className="overflow-hidden rounded-xl border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-line">
                    {descriptionData.details.filter((row) => row.label && row.value).map((row) => (
                      <tr key={row.label}>
                        <td className="px-3 py-2 font-medium text-slate-700">{row.label}</td>
                        <td className="px-3 py-2 text-slate-600">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Variant</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Price</th><th className="px-3 py-3">Stock</th></tr></thead>
              <tbody className="divide-y divide-line">
                {(product?.product_variants?.length ? product.product_variants : [{ id: "default", option1_value: "Default", sku: product?.sku, price: product?.price, stock: product?.stock }]).map((variant: any) => (
                  <tr key={variant.id}><td className="px-3 py-3">{[variant.option1_value, variant.option2_value, variant.option3_value].filter(Boolean).join(" / ") || "Default"}</td><td className="px-3 py-3">{variant.sku}</td><td className="px-3 py-3">{formatCurrency(variant.price ?? product?.price)}</td><td className="px-3 py-3">{variant.stock ?? product?.stock}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {adminUrl && <a href={adminUrl} className="mt-5 inline-block rounded-md border border-line px-4 py-2 text-sm font-semibold">Open Shopify Draft</a>}
        </section>
        {product && <AdminProductReviewPanel product={{ ...product, shopifyAdminUrl: adminUrl, shopifyWarnings }} />}
      </div>
    </DashboardShell>
  );
}
