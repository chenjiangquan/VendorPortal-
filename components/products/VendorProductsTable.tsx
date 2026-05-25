"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getDisplayPrice } from "@/lib/product-pricing";
import { formatDate } from "@/lib/utils";

type VendorProductRow = {
  id: string;
  title: string;
  sku?: string | null;
  price?: number | null;
  stock?: number | null;
  status: string;
  created_at?: string | null;
  category?: string | null;
  product_type?: string | null;
  shopify_product_id?: string | null;
  has_variants?: boolean | null;
  product_variants?: { price?: number | null }[];
  product_change_requests?: { request_type: string; status: string }[];
};

export function VendorProductsTable({
  products,
  requestFilter,
  status,
  sort,
  direction
}: {
  products: VendorProductRow[];
  requestFilter?: "edit" | "delete";
  status?: string;
  sort?: string;
  direction?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return products.filter((product) => {
      const pending = product.product_change_requests?.filter((request) => request.status === "pending") ?? [];
      if (requestFilter && !pending.some((request) => request.request_type === requestFilter)) return false;
      if (!term) return true;
      return [product.title, product.sku, product.category, product.product_type, product.shopify_product_id].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [products, requestFilter, debouncedSearch]);
  const selectableIds = filteredProducts.filter((product) => product.status !== "archived").map((product) => product.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  function toggleSelected(productId: string, checked: boolean) {
    setSelectedIds((current) => checked ? Array.from(new Set([...current, productId])) : current.filter((id) => id !== productId));
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!window.confirm("Selected Shopify Draft products will be sent to admin as delete requests. Other selected products will be archived locally.")) return;
    setLoading(true);
    const res = await fetch("/api/vendor/products/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: selectedIds })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? "Bulk delete failed.");
      return;
    }
    toast.success(json.message ?? "Bulk delete submitted.");
    if (json.failedCount) toast.error(`${json.failedCount} products failed.`);
    setSelectedIds([]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <span className="text-sm font-semibold text-ink">{selectedIds.length} selected</span>
          <button disabled={loading} onClick={bulkDelete} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
            {loading ? "Submitting..." : "Bulk delete"}
          </button>
        </div>
      )}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products by title, SKU or category..." className="focus-ring w-full rounded-xl border border-line px-4 py-2 text-sm shadow-sm" />
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
              <SortableHeader label="Title" field="title" status={status} sort={sort} direction={direction} />
              <th className="px-4 py-3">SKU</th>
              <SortableHeader label="Price" field="price" status={status} sort={sort} direction={direction} />
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <SortableHeader label="Created" field="created_at" status={status} sort={sort} direction={direction} />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredProducts.map((product) => {
              const href = `/vendor/products/${product.id}`;
              const canRequestChanges = ["approved", "shopify_draft"].includes(product.status);
              const pending = product.product_change_requests?.filter((request) => request.status === "pending") ?? [];
              return (
                <tr key={product.id} onClick={() => router.push(href)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(product.id)} disabled={product.status === "archived"} onChange={(event) => toggleSelected(product.id, event.target.checked)} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={href} onClick={(event) => event.stopPropagation()} className="font-medium text-ink hover:underline">{product.title}</Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {canRequestChanges && !pending.length && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Change requests available</span>}
                      {pending.some((request) => request.request_type === "edit") && <StatusBadge status="update_pending" />}
                      {pending.some((request) => request.request_type === "delete") && <StatusBadge status="delete_pending" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">{product.sku || "-"}</td>
                  <td className="px-4 py-3">{getDisplayPrice(product)}</td>
                  <td className="px-4 py-3">{product.stock}</td>
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

function SortableHeader({ label, field, status, sort, direction }: { label: string; field: string; status?: string; sort?: string; direction?: string }) {
  return (
    <th className="px-4 py-3">
      <Link href={sortHref(field, status, sort, direction)} className="inline-flex items-center gap-1 hover:text-ink">
        {label} <span>{sort === field ? direction === "asc" ? "↑" : "↓" : "↕"}</span>
      </Link>
    </th>
  );
}

function sortHref(field: string, status?: string, sort?: string, direction?: string) {
  const params = new URLSearchParams();
  if (status && status !== "active") params.set("status", status);
  if (sort !== field) {
    params.set("sort", field);
    params.set("direction", "asc");
  } else if (direction === "asc") {
    params.set("sort", field);
    params.set("direction", "desc");
  }
  const query = params.toString();
  return query ? `/vendor/products?${query}` : "/vendor/products";
}
