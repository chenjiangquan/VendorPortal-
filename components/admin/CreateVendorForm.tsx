"use client";

import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";

export function CreateVendorForm() {
  const [result, setResult] = useState<{ email: string; password: string; loginUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const payload = Object.fromEntries(formData.entries());
    const res = await fetch("/api/admin/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? "Could not create vendor.");
      return;
    }
    setResult(json.loginDetails);
    toast.success("Vendor account created.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <form action={onSubmit} className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="company_name" label="Company name" required />
          <Field name="contact_name" label="Contact name" required />
          <Field name="email" label="Email" type="email" required />
          <Field name="temporary_password" label="Temporary password" type="text" required minLength={10} />
          <Field name="phone" label="Phone" />
          <Field name="country" label="Country" defaultValue="United Kingdom" />
          <Field name="city" label="City" />
          <Field name="shopify_vendor_name" label="Shopify vendor name" />
          <Field name="commission_rate" label="Commission rate" type="number" defaultValue="0" />
          <label className="md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea name="notes" rows={4} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" />
          </label>
        </div>
        <button disabled={loading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60">
          <Plus className="h-4 w-4" />
          {loading ? "Creating..." : "Create vendor"}
        </button>
      </form>
      <aside className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Login details</h2>
        <p className="mt-2 text-sm text-slate-500">First version does not send email automatically. Copy these details and send them to the vendor securely.</p>
        {result ? (
          <div className="mt-4 space-y-3 text-sm">
            <CopyRow label="Login URL" value={result.loginUrl} />
            <CopyRow label="Email" value={result.email} />
            <CopyRow label="Temporary password" value={result.password} />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-line p-4 text-sm text-slate-500">Create a vendor to reveal copyable login details.</div>
        )}
      </aside>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, ...inputProps } = props;
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input {...inputProps} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" />
    </label>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}</span>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Copied"))}
        className="mt-1 flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-2 text-left text-sm font-medium shadow-sm"
      >
        <span className="truncate">{value}</span>
        <Copy className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    </div>
  );
}
