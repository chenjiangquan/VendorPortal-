"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function TrackingForm({ orderId }: { orderId: string }) {
  const router = useRouter();

  async function submit(formData: FormData) {
    const payload = { ...Object.fromEntries(formData.entries()), vendor_order_id: orderId };
    const res = await fetch("/api/vendor/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Could not submit tracking.");
      return;
    }
    toast.success("Tracking submitted to admin.");
    router.refresh();
  }

  return (
    <form action={submit} className="rounded-lg border border-line bg-white p-5">
      <h3 className="font-semibold">Submit Tracking</h3>
      <p className="mt-1 text-sm text-slate-500">Tracking has been submitted to admin. Our team will review and update the Shopify order fulfillment.</p>
      <div className="mt-4 grid gap-3">
        <input name="carrier" placeholder="Carrier" required className="focus-ring rounded-md border border-line px-3 py-2" />
        <input name="tracking_number" placeholder="Tracking number" required className="focus-ring rounded-md border border-line px-3 py-2" />
        <input name="tracking_url" placeholder="Tracking URL" className="focus-ring rounded-md border border-line px-3 py-2" />
        <textarea name="note" placeholder="Note" rows={3} className="focus-ring rounded-md border border-line px-3 py-2" />
      </div>
      <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"><Send className="h-4 w-4" />Submit Tracking</button>
    </form>
  );
}
