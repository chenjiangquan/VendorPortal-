"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ProductRequestReviewPanel({ requestId, type }: { requestId: string; type: "edit" | "delete" }) {
  const router = useRouter();
  const [adminNote, setAdminNote] = useState("");
  const [technicalError, setTechnicalError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function post(action: "approve" | "reject") {
    setLoading(true);
    setTechnicalError(null);
    const res = await fetch(`/api/admin/product-requests/${requestId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ admin_note: adminNote }) : undefined
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? "Action failed.");
      if (json.details) setTechnicalError(json.details);
      return;
    }
    toast.success(json.message ?? "Done.");
    if (json.warning) toast.warning(json.warning);
    router.push(type === "edit" ? "/admin/products/edit-requests" : "/admin/products/delete-requests");
    router.refresh();
  }

  return (
    <aside className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-semibold">{type === "edit" ? "Review update request" : "Review delete request"}</h2>
      <div className="mt-4 space-y-3">
        <button disabled={loading} onClick={() => post("approve")} className="w-full rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
          {type === "edit" ? "Approve update" : "Approve delete"}
        </button>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Reject note</span>
          <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} rows={3} className="focus-ring mt-1 w-full rounded-xl border border-line px-4 py-2 text-sm shadow-sm" />
        </label>
        <button disabled={loading || !adminNote.trim()} onClick={() => post("reject")} className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
          Reject request
        </button>
      </div>
      {technicalError ? (
        <details className="mt-4 rounded-xl border border-line bg-panel p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-700">Show technical error</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-slate-600">{JSON.stringify(technicalError, null, 2)}</pre>
        </details>
      ) : null}
    </aside>
  );
}
