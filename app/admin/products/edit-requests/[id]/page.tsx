import { ProductRequestReviewPanel } from "@/components/admin/ProductRequestReviewPanel";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireRole } from "@/lib/auth";
import { normaliseDescriptionData } from "@/lib/product-description";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function AdminEditRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("product_change_requests")
    .select("*, vendor_products(*, vendors(*), product_images(*), product_variants(*))")
    .eq("id", id)
    .eq("request_type", "edit")
    .single();
  if (!request) notFound();
  const product = request.vendor_products;
  const proposed = request.proposed_data ?? {};
  const currentDescription = normaliseDescriptionData(product?.description_data);
  const proposedDescription = normaliseDescriptionData(proposed.description_data);

  return (
    <DashboardShell role="admin" title="Edit Request">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-xl font-semibold">{product?.title}</h2><p className="text-sm text-slate-500">{product?.vendors?.company_name}</p></div>
              <StatusBadge status={request.status} />
            </div>
            {request.reason && <p className="mt-3 rounded-xl bg-panel p-3 text-sm text-slate-600">{request.reason}</p>}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <CompareCard title="Current product" product={product} description={currentDescription} />
            <CompareCard title="Proposed changes" product={proposed} description={proposedDescription} />
          </div>
        </section>
        <ProductRequestReviewPanel requestId={request.id} type="edit" />
      </div>
    </DashboardShell>
  );
}

function CompareCard({ title, product, description }: { title: string; product: any; description: any }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-4 grid gap-3 text-sm">
        <div><dt className="text-slate-500">Title</dt><dd>{product?.title ?? "-"}</dd></div>
        <div><dt className="text-slate-500">SKU</dt><dd>{product?.sku ?? "-"}</dd></div>
        <div><dt className="text-slate-500">Price</dt><dd>{formatCurrency(product?.price)}</dd></div>
        <div><dt className="text-slate-500">Stock</dt><dd>{product?.stock ?? "-"}</dd></div>
        <div><dt className="text-slate-500">Category</dt><dd>{product?.category ?? "-"}</dd></div>
      </dl>
      <div className="mt-5">
        <h4 className="text-sm font-semibold text-slate-700">Overview</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{description.overview.map((line: string) => <li key={line}>{line}</li>)}</ul>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-line">
        <table className="w-full text-left text-sm"><tbody className="divide-y divide-line">{description.details.filter((row: any) => row.label && row.value).map((row: any) => <tr key={row.label}><td className="px-3 py-2 font-medium">{row.label}</td><td className="px-3 py-2">{row.value}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
