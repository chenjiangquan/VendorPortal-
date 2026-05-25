"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function DeleteVendorButton({
  vendorId,
  vendorName,
  redirectToList = false
}: {
  vendorId: string;
  vendorName: string;
  redirectToList?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function deleteVendor(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const confirmed = window.confirm(`Delete vendor "${vendorName}"? This removes the vendor account and related portal data from the database.`);
    if (!confirmed) return;

    setLoading(true);
    const res = await fetch(`/api/admin/vendors/${vendorId}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      toast.error(json.error ?? "Vendor could not be deleted.");
      return;
    }

    toast.success("Vendor deleted.");
    if (redirectToList) {
      router.push("/admin/vendors");
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={deleteVendor}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Trash2 className="h-4 w-4" />
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
