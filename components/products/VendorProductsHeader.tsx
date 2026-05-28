"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const FILTERS = [
  ["active", "product.filterAll"],
  ["draft", "product.filterDraft"],
  ["submitted", "product.filterSubmitted"],
  ["approved", "product.filterApproved"],
  ["rejected", "product.filterRejected"],
  ["shopify_draft", "product.filterLive"],
  ["update_pending", "product.filterUpdatePending"],
  ["delete_pending", "product.filterDeletePending"],
  ["archived", "product.filterArchived"]
] as const;

export function VendorProductsHeader({ activeStatus, sort, direction }: { activeStatus: string; sort?: string; direction?: string }) {
  const { t } = useI18n();
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([value, labelKey]) => (
          <Link key={value} href={statusHref(value, sort, direction)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeStatus === value ? "bg-ink text-white" : "border border-line bg-white text-slate-700"}`}>
            {t(labelKey)}
          </Link>
        ))}
      </div>
      <Link href="/vendor/products/new" className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm">{t("product.addProduct")}</Link>
    </div>
  );
}

function statusHref(status: string, sort?: string, direction?: string) {
  const params = new URLSearchParams();
  if (status !== "active") params.set("status", status);
  if (sort) params.set("sort", sort);
  if (direction) params.set("direction", direction);
  const query = params.toString();
  return query ? `/vendor/products?${query}` : "/vendor/products";
}
