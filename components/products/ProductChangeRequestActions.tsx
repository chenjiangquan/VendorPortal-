"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function ProductChangeRequestActions({
  productId,
  hasPendingEdit,
  hasPendingDelete
}: {
  productId: string;
  hasPendingEdit?: boolean;
  hasPendingDelete?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function submitDeleteRequest() {
    setLoading(true);
    const res = await fetch("/api/vendor/product-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, request_type: "delete", reason: null })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? t("product.deleteRequestFailed"));
      return;
    }
    toast.success(t("product.deleteRequestSubmitted"));
    router.refresh();
  }

  return (
    <section className="mb-5 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink">{t("product.changeRequestsTitle")}</h2>
      <p className="mt-2 text-sm text-slate-500">{t("product.changeRequestsHelp")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasPendingEdit ? (
          <span className="rounded-xl bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-800">{t("product.filterUpdatePending")}</span>
        ) : (
          <Link href={`/vendor/products/${productId}?request=edit`} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm">{t("product.requestProductUpdate")}</Link>
        )}
        {hasPendingDelete ? (
          <span className="rounded-xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">{t("product.filterDeletePending")}</span>
        ) : (
          <button disabled={loading} onClick={submitDeleteRequest} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
            {loading ? t("common.submitting") : t("product.requestDelete")}
          </button>
        )}
      </div>
    </section>
  );
}
