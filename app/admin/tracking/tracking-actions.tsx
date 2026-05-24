"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function TrackingActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  async function action(kind: "review" | "reject") {
    const body = kind === "reject" ? { admin_note: prompt("Admin note") ?? "" } : undefined;
    const res = await fetch(`/api/admin/tracking/${id}/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Action failed.");
      return;
    }
    toast.success(json.message ?? "Updated.");
    router.refresh();
  }
  if (status !== "submitted") return null;
  return <div className="mt-4 flex gap-2"><button onClick={() => action("review")} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Mark Reviewed</button><button onClick={() => action("reject")} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white">Reject Tracking</button></div>;
}
