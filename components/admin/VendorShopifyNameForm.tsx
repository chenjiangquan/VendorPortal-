"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

export function VendorShopifyNameForm({
  vendorId,
  initialShopifyVendorName
}: {
  vendorId: string;
  initialShopifyVendorName?: string | null;
}) {
  const router = useRouter();
  const [shopifyVendorName, setShopifyVendorName] = useState(initialShopifyVendorName ?? "");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const res = await fetch(`/api/admin/vendors/${vendorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopify_vendor_name: shopifyVendorName.trim() || null })
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      toast.error(json.error ?? "Could not update Shopify vendor name.");
      return;
    }

    toast.success("Shopify vendor name updated.");
    router.refresh();
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-semibold text-ink">Shopify vendor name</h2>
        <p className="mt-1 text-sm text-slate-500">
          Future Shopify Draft products from this vendor will use this vendor name. Existing Shopify products are not changed automatically.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <label className="flex-1">
          <span className="text-sm font-medium text-slate-700">Vendor name sent to Shopify</span>
          <input
            value={shopifyVendorName}
            onChange={(event) => setShopifyVendorName(event.target.value)}
            placeholder="e.g. Foshan Sofabed Factory"
            className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}
