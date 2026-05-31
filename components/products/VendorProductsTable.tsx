"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [bulkPriceValue, setBulkPriceValue] = useState("");
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
  const selectedProducts = useMemo(() => products.filter((product) => selectedIds.includes(product.id)), [products, selectedIds]);
  const priceRequestProducts = selectedProducts.filter((product) => ["approved", "shopify_draft"].includes(product.status) && !product.product_change_requests?.some((request) => request.request_type === "edit" && request.status === "pending"));
  const submitProducts = selectedProducts.filter((product) => ["draft", "rejected"].includes(product.status));

  function toggleSelected(productId: string, checked: boolean) {
    setSelectedIds((current) => checked ? Array.from(new Set([...current, productId])) : current.filter((id) => id !== productId));
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!window.confirm(t("product.bulkDeleteConfirm"))) return;
    setLoading(true);
    const res = await fetch("/api/vendor/products/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: selectedIds })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? t("product.bulkDeleteFailed"));
      return;
    }
    toast.success(json.message ?? t("product.bulkDeleteSubmitted"));
    if (json.failedCount) toast.error(t("product.productsFailed").replace("{count}", String(json.failedCount)));
    setSelectedIds([]);
    router.refresh();
  }

  async function bulkSubmit() {
    if (!submitProducts.length) {
      toast.error(t("product.selectSubmitProducts"));
      return;
    }
    setLoading(true);
    const res = await fetch("/api/vendor/products/bulk-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: submitProducts.map((product) => product.id) })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      console.error(json.details ?? json.error);
      toast.error(json.error ?? t("product.bulkSubmitFailed"));
      return;
    }
    toast.success(json.message ?? t("product.bulkSubmitSubmitted").replace("{count}", String(json.successCount ?? 0)));
    if (json.failedCount) toast.error(t("product.productsFailed").replace("{count}", String(json.failedCount)));
    setSelectedIds([]);
    router.refresh();
  }

  function openPriceModal() {
    if (!priceRequestProducts.length) {
      toast.error(t("product.selectPriceUpdateProducts"));
      return;
    }
    setPriceDrafts(Object.fromEntries(priceRequestProducts.map((product) => [product.id, ""])));
    setBulkPriceValue("");
    setPriceModalOpen(true);
  }

  function applyBulkPriceToAll(value: string) {
    setBulkPriceValue(value);
    setPriceDrafts(Object.fromEntries(priceRequestProducts.map((product) => [product.id, value])));
  }

  async function submitBulkPriceUpdate() {
    const items = priceRequestProducts.map((product) => ({ productId: product.id, price: Number(priceDrafts[product.id]) })).filter((item) => Number.isFinite(item.price) && item.price > 0);
    if (items.length !== priceRequestProducts.length) {
      toast.error(t("product.validPriceRequired"));
      return;
    }
    setLoading(true);
    const res = await fetch("/api/vendor/product-requests/bulk-price-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? t("product.priceRequestsFailed"));
      return;
    }
    toast.success(json.message ?? t("product.priceRequestsSubmitted").replace("{count}", String(json.successCount ?? 0)));
    if (json.failedCount) toast.error(t("product.productsFailed").replace("{count}", String(json.failedCount)));
    setPriceModalOpen(false);
    setSelectedIds([]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <span className="text-sm font-semibold text-ink">{t("common.selected").replace("{count}", String(selectedIds.length))}</span>
          <div className="flex flex-wrap gap-2">
            <button disabled={loading || !submitProducts.length} onClick={bulkSubmit} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
              {loading ? t("common.submitting") : t("product.bulkSubmit")}
            </button>
            <button disabled={loading || !priceRequestProducts.length} onClick={openPriceModal} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm disabled:opacity-50">
              {t("product.bulkPriceUpdate")}
            </button>
            <button disabled={loading} onClick={bulkDelete} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
              {loading ? t("common.submitting") : t("product.bulkDelete")}
            </button>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("product.searchPlaceholder")} className="focus-ring w-full rounded-xl border border-line px-4 py-2 text-sm shadow-sm" />
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
              <SortableHeader label={t("product.title")} field="title" status={status} sort={sort} direction={direction} />
              <th className="px-4 py-3">SKU</th>
              <SortableHeader label={t("product.price")} field="price" status={status} sort={sort} direction={direction} />
              <th className="px-4 py-3">{t("product.stock")}</th>
              <th className="px-4 py-3">{t("product.status")}</th>
              <SortableHeader label={t("product.created")} field="created_at" status={status} sort={sort} direction={direction} />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredProducts.map((product) => {
              const href = `/vendor/products/${product.id}`;
              const pending = product.product_change_requests?.filter((request) => request.status === "pending") ?? [];
              return (
                <tr key={product.id} onClick={() => router.push(href)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(product.id)} disabled={product.status === "archived"} onChange={(event) => toggleSelected(product.id, event.target.checked)} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={href} onClick={(event) => event.stopPropagation()} className="font-medium text-ink hover:underline">{product.title}</Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pending.some((request) => request.request_type === "edit") && <StatusBadge status="update_pending" />}
                      {pending.some((request) => request.request_type === "delete") && <StatusBadge status="delete_pending" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">{product.sku || "-"}</td>
                  <td className="px-4 py-3">{getDisplayPrice(product)}</td>
                  <td className="px-4 py-3">{product.stock}</td>
                  <td className="px-4 py-3"><StatusBadge status={product.status} label={product.status === "shopify_draft" ? t("product.statusLive") : undefined} /></td>
                  <td className="px-4 py-3">{formatDate(product.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredProducts.length && <div className="p-8 text-center text-sm text-slate-500">{t("product.noProductsFound")}</div>}
      </div>
      {priceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">{t("product.bulkPriceTitle")}</h3>
                <p className="mt-1 text-sm text-slate-500">{t("product.bulkPriceHelp")}</p>
              </div>
              <button type="button" onClick={() => setPriceModalOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-panel">{t("common.close")}</button>
            </div>
            <div className="mt-5 max-h-[55vh] overflow-y-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3">{t("nav.products")}</th>
                    <th className="px-3 py-3">{t("product.currentPrice")}</th>
                    <th className="px-3 py-3">
                      <div className="space-y-2">
                        <span>{t("product.newPrice")}</span>
                        <div className="flex overflow-hidden rounded-lg border border-line bg-white normal-case focus-within:ring-2 focus-within:ring-slate-900/10">
                          <span className="flex items-center border-r border-line bg-panel px-2 text-xs font-semibold text-slate-500">$</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={bulkPriceValue}
                            onChange={(event) => applyBulkPriceToAll(event.target.value)}
                            className="w-full min-w-28 border-0 px-2 py-1 text-sm font-normal outline-none"
                            placeholder={t("product.applySamePrice")}
                          />
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {priceRequestProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink">{product.title}</div>
                        {product.has_variants && <div className="mt-1 text-xs text-slate-500">{t("product.variantBulkPriceHelp")}</div>}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{getDisplayPrice(product)}</td>
                      <td className="px-3 py-3">
                        <div className="flex overflow-hidden rounded-lg border border-line bg-white focus-within:ring-2 focus-within:ring-slate-900/10">
                          <span className="flex items-center border-r border-line bg-panel px-2 text-xs font-semibold text-slate-500">$</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={priceDrafts[product.id] ?? ""}
                            onChange={(event) => setPriceDrafts((current) => ({ ...current, [product.id]: event.target.value }))}
                            className="w-full border-0 px-2 py-1 text-sm outline-none"
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setPriceModalOpen(false)} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm">{t("common.cancel")}</button>
              <button type="button" disabled={loading} onClick={submitBulkPriceUpdate} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                {loading ? t("common.submitting") : t("product.submitPriceRequests")}
              </button>
            </div>
          </div>
        </div>
      )}
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
