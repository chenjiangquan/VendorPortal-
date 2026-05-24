"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";

type ProductRequestRow = {
  id: string;
  request_type: "edit" | "delete";
  status: string;
  reason?: string | null;
  created_at?: string | null;
  vendor_products?: {
    id: string;
    title: string;
    sku?: string | null;
    category?: string | null;
    product_type?: string | null;
    shopify_product_id?: string | null;
    shopify_status?: string | null;
  } | null;
  vendors?: { company_name?: string | null } | null;
};

export function ProductRequestsTable({ requests, type }: { requests: ProductRequestRow[]; type: "edit" | "delete" }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [technicalError, setTechnicalError] = useState<unknown>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) => [
      request.vendor_products?.title,
      request.vendor_products?.sku,
      request.vendor_products?.category,
      request.vendor_products?.product_type,
      request.vendor_products?.shopify_product_id,
      request.vendors?.company_name
    ].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [requests, debouncedSearch]);
  const allSelected = filtered.length > 0 && filtered.every((request) => selectedIds.includes(request.id));

  async function bulkApprove() {
    setLoading(true);
    setTechnicalError(null);
    const res = await fetch(type === "edit" ? "/api/admin/product-requests/bulk-approve-edits" : "/api/admin/product-requests/bulk-approve-deletes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestIds: selectedIds })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? "Bulk approval failed.");
      if (json.details) setTechnicalError(json.details);
      return;
    }
    toast.success(`${json.successCount ?? 0} completed. ${json.failedCount ?? 0} failed.`);
    if (json.failedItems?.length) setTechnicalError(json.failedItems);
    setSelectedIds([]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <span className="text-sm font-semibold text-ink">{selectedIds.length} selected</span>
          <button disabled={loading} onClick={bulkApprove} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
            {loading ? "Approving..." : type === "edit" ? "Approve Updates" : "Approve Deletes"}
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
              <th className="w-12 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? filtered.map((request) => request.id) : [])} onClick={(event) => event.stopPropagation()} /></th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">{type === "delete" ? "Shopify Product ID" : "Current Shopify Status"}</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((request) => {
              const href = `/admin/products/${type}-requests/${request.id}`;
              return (
                <tr key={request.id} onClick={() => router.push(href)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(request.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, request.id])] : current.filter((id) => id !== request.id))} /></td>
                  <td className="px-4 py-3"><Link href={href} onClick={(event) => event.stopPropagation()} className="font-medium text-ink hover:underline">{request.vendor_products?.title}</Link></td>
                  <td className="px-4 py-3">{request.vendors?.company_name ?? "-"}</td>
                  <td className="px-4 py-3">{type === "delete" ? request.vendor_products?.shopify_product_id ?? "-" : request.vendor_products?.shopify_status ?? "-"}</td>
                  <td className="px-4 py-3">{formatDate(request.created_at)}</td>
                  <td className="max-w-xs truncate px-4 py-3">{request.reason || "-"}</td>
                  <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && <div className="p-8 text-center text-sm text-slate-500">No requests found.</div>}
      </div>
    </div>
  );
}
