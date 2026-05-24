"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function SyncOrdersButton() {
  const router = useRouter();
  async function sync() {
    const res = await fetch("/api/admin/sync-orders", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Sync failed.");
      return;
    }
    toast.success(`Synced ${json.orderCount} vendor orders.`);
    router.refresh();
  }
  return <button onClick={sync} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm"><RefreshCw className="h-4 w-4" />Sync latest Shopify orders</button>;
}
