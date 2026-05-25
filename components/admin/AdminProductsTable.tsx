"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getDisplayPrice } from "@/lib/product-pricing";
import { formatDate } from "@/lib/utils";

type AdminProductRow = {
  id: string;
  title: string;
  sku?: string | null;
  price?: number | null;
  has_variants?: boolean | null;
  product_variants?: { price?: number | null }[];
  status: string;
  created_at?: string | null;
  shopify_product_gid?: string | null;
  shopify_product_id?: string | null;
  category?: string | null;
  product_type?: string | null;
  vendors?: { company_name?: string | null } | null;
};

export function AdminProductsTable({ products }: { products: AdminProductRow[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [technicalError, setTechnicalError] = useState<unknown>(null);
  const selectableIds = useMemo(() => products.filter((product) => product.status === "submitted" && !product.shopify_product_gid).map((product) => product.id), [products]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => [product.title, product.sku, product.category, product.product_type, product.shopify_product_id, product.vendors?.company_name].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [products, debouncedSearch]);

  function toggleSelected(productId: string, checked: boolean) {
    setSelectedIds((current) => checked ? Array.from(new Set([...current, productId])) : current.filter((id) => id !== productId));
  }

  async function bulkCreateDrafts() {
    setLoading(true);
    setTechnicalError(null);
    const res = await fetch("/api/admin/products/bulk-create-shopify-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: selectedIds })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      toast.error(json.error ?? "Bulk action failed.");
      if (json.details) setTechnicalError(json.details);
      return;
    }

    toast.success(`${json.successCount ?? 0} Shopify drafts created. ${json.failedCount ?? 0} failed.`);
    if (json.failedItems?.length) setTechnicalError(json.failedItems);
    setSelectedIds([]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <span className="text-sm font-semibold text-ink">{selectedIds.length} selected</span>
          <button disabled={loading} onClick={bulkCreateDrafts} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
            {loading ? "Creating..." : "Create Shopify Drafts"}
          </button>
        </div>
      )}
      {technicalError ? (
        <details className="rounded-2xl border border-line bg-white p-4 text-xs shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Show technical error</summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-panel p-3 text-slate-600">{JSON.stringify(technicalError, null, 2)}</pre>
        </details>
      ) : null}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products by title, SKU, vendor or category..." className="focus-ring w-full rounded-xl border border-line px-4 py-2 text-sm shadow-sm" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={!selectableIds.length}
                  onChange={(event) => setSelectedIds(event.target.checked ? selectableIds : [])}
                  onClick={(event) => event.stopPropagation()}
                />
              </th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredProducts.map((product) => {
              const href = `/admin/products/${product.id}`;
              const selectable = product.status === "submitted" && !product.shopify_product_gid;
              return (
                <tr key={product.id} onClick={() => router.push(href)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(product.id)} disabled={!selectable} onChange={(event) => toggleSelected(product.id, event.target.checked)} />
                  </td>
                  <td className="px-4 py-3"><Link href={href} onClick={(event) => event.stopPropagation()} className="font-medium text-ink hover:underline">{product.title}</Link></td>
                  <td className="px-4 py-3">{product.vendors?.company_name ?? "-"}</td>
                  <td className="px-4 py-3">{product.sku || "-"}</td>
                  <td className="px-4 py-3">{getDisplayPrice(product)}</td>
                  <td className="px-4 py-3"><StatusBadge status={product.status} /></td>
                  <td className="px-4 py-3">{formatDate(product.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredProducts.length && <div className="p-8 text-center text-sm text-slate-500">No products found.</div>}
      </div>
    </div>
  );
}
