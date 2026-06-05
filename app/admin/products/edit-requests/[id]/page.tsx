import { ProductChangeDiffPanel } from "@/components/admin/ProductChangeDiffPanel";
import { ProductRequestReviewPanel } from "@/components/admin/ProductRequestReviewPanel";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireRole } from "@/lib/auth";
import { getProductChangeDiff } from "@/lib/product-diff";
import { normaliseDescriptionData } from "@/lib/product-description";
import { getDisplayPrice } from "@/lib/product-pricing";
import { createClient } from "@/lib/supabase/server";
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
  const diff = getProductChangeDiff(product ?? {}, proposed as Record<string, any>);

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
            <CompareCard title="Proposed changes" product={proposed} description={proposedDescription} compareTo={product} compareDescription={currentDescription} />
          </div>
          <ProductChangeDiffPanel diff={diff} />
        </section>
        <ProductRequestReviewPanel requestId={request.id} type="edit" />
      </div>
    </DashboardShell>
  );
}

function CompareCard({
  title,
  product,
  description,
  compareTo,
  compareDescription
}: {
  title: string;
  product: any;
  description: any;
  compareTo?: any;
  compareDescription?: any;
}) {
  const isChanged = (field: string, value: unknown) => compareTo ? formatComparable(compareTo?.[field]) !== formatComparable(value) : false;
  const priceChanged = compareTo ? getDisplayPrice(compareTo) !== getDisplayPrice(product) : false;
  const overviewChanged = compareDescription ? JSON.stringify(compareDescription.overview ?? []) !== JSON.stringify(description.overview ?? []) : false;

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-4 grid gap-3 text-sm">
        <div><dt className="text-slate-500">Title</dt><ChangedValue changed={isChanged("title", product?.title)}>{product?.title ?? "-"}</ChangedValue></div>
        <div><dt className="text-slate-500">SKU</dt><ChangedValue changed={isChanged("sku", product?.sku)}>{product?.sku ?? "-"}</ChangedValue></div>
        <div><dt className="text-slate-500">Price</dt><ChangedValue changed={priceChanged}>{getDisplayPrice(product)}</ChangedValue></div>
        <div><dt className="text-slate-500">Stock</dt><ChangedValue changed={isChanged("stock", product?.stock)}>{product?.stock ?? "-"}</ChangedValue></div>
        <div><dt className="text-slate-500">Category</dt><ChangedValue changed={isChanged("category", product?.category)}>{product?.category ?? "-"}</ChangedValue></div>
      </dl>
      <div className="mt-5">
        <h4 className="text-sm font-semibold text-slate-700">Overview</h4>
        <ul className={`mt-2 list-disc space-y-1 rounded-xl pl-5 text-sm ${overviewChanged ? "bg-red-50 px-4 py-3 text-red-700 ring-1 ring-red-100" : "text-slate-600"}`}>
          {description.overview.map((line: string) => <li key={line}>{line}</li>)}
        </ul>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-line">
            {description.details.filter((row: any) => row.label && row.value).map((row: any) => {
              const changed = detailChanged(row, compareDescription);
              return (
                <tr key={row.label} className={changed ? "bg-red-50/70" : ""}>
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className={`px-3 py-2 ${changed ? "font-semibold text-red-700" : ""}`}>{row.value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChangedValue({ changed, children }: { changed: boolean; children: React.ReactNode }) {
  return <dd className={changed ? "inline-flex rounded-lg bg-red-50 px-2 py-1 font-semibold text-red-700 ring-1 ring-red-100" : ""}>{children}</dd>;
}

function formatComparable(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function detailChanged(row: { id?: string; label?: string; value?: string }, compareDescription?: any) {
  if (!compareDescription) return false;
  const before = (compareDescription.details ?? []).find((item: any) => (item.id && item.id === row.id) || item.label === row.label);
  return String(before?.value ?? "") !== String(row.value ?? "");
}
