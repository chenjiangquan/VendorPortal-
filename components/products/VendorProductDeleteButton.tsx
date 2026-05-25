"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function VendorProductDeleteButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function deleteProduct() {
    const confirmed = window.confirm("Delete this product? It will be removed from your active products.");
    if (!confirmed) return;

    setLoading(true);
    const res = await fetch("/api/vendor/products/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: [productId] })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      toast.error(json.error ?? "Product could not be deleted.");
      return;
    }

    toast.success(json.requestCount ? "Delete request submitted." : "Product deleted.");
    router.push("/vendor/products");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={deleteProduct}
      disabled={loading}
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Deleting..." : "Delete product"}
    </button>
  );
}
