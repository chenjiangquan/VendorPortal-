"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

type VendorEditFormProps = {
  vendor: {
    id: string;
    company_name?: string | null;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    country?: string | null;
    city?: string | null;
    address?: string | null;
    postcode?: string | null;
    business_type?: string | null;
    shopify_vendor_name?: string | null;
    commission_rate?: number | null;
    status?: string | null;
    notes?: string | null;
  };
};

export function VendorEditForm({ vendor }: VendorEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function save(formData: FormData) {
    setLoading(true);
    const payload = {
      company_name: String(formData.get("company_name") ?? "").trim(),
      contact_name: String(formData.get("contact_name") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      country: String(formData.get("country") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      postcode: String(formData.get("postcode") ?? "").trim() || null,
      business_type: String(formData.get("business_type") ?? "").trim() || null,
      shopify_vendor_name: String(formData.get("shopify_vendor_name") ?? "").trim() || null,
      commission_rate: String(formData.get("commission_rate") ?? "0"),
      status: String(formData.get("status") ?? "active"),
      notes: String(formData.get("notes") ?? "").trim() || null
    };

    const res = await fetch(`/api/admin/vendors/${vendor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      toast.error(json.error ?? "Could not update vendor.");
      return;
    }

    toast.success("Vendor updated.");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-semibold text-ink">Edit vendor information</h2>
        <p className="mt-1 text-sm text-slate-500">
          Update contact details and the Shopify vendor name used for future draft products.
        </p>
      </div>
      <form action={save} className="mt-5 grid gap-4 md:grid-cols-2">
        <Field name="company_name" label="Company name" defaultValue={vendor.company_name ?? ""} required />
        <Field name="contact_name" label="Contact name" defaultValue={vendor.contact_name ?? ""} />
        <Field name="email" label="Vendor email" defaultValue={vendor.email ?? ""} type="email" required />
        <Field name="phone" label="Phone" defaultValue={vendor.phone ?? ""} />
        <Field name="shopify_vendor_name" label="Shopify vendor name" defaultValue={vendor.shopify_vendor_name ?? ""} />
        <Field name="commission_rate" label="Commission rate" defaultValue={vendor.commission_rate ?? 0} type="number" step="0.01" />
        <Field name="website" label="Website" defaultValue={vendor.website ?? ""} />
        <Field name="business_type" label="Business type" defaultValue={vendor.business_type ?? ""} />
        <Field name="country" label="Country" defaultValue={vendor.country ?? "United Kingdom"} />
        <Field name="city" label="City" defaultValue={vendor.city ?? ""} />
        <Field name="address" label="Address" defaultValue={vendor.address ?? ""} className="md:col-span-2" />
        <Field name="postcode" label="Postcode" defaultValue={vendor.postcode ?? ""} />
        <label>
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select name="status" defaultValue={vendor.status ?? "active"} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm">
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea name="notes" defaultValue={vendor.notes ?? ""} rows={4} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" />
        </label>
        <div className="md:col-span-2">
          <button disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60">
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save vendor"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; className?: string }) {
  return (
    <label className={className}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input {...props} defaultValue={props.defaultValue ?? ""} className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" />
    </label>
  );
}
