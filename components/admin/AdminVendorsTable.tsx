"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeleteVendorButton } from "@/components/admin/DeleteVendorButton";
import { StatusBadge } from "@/components/ui/StatusBadge";

type VendorRow = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  email: string;
  commission_rate?: number | null;
  status: string;
  shopify_vendor_name?: string | null;
  city?: string | null;
  country?: string | null;
};

export function AdminVendorsTable({ rows }: { rows: VendorRow[] }) {
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((vendor) =>
      [
        vendor.company_name,
        vendor.contact_name,
        vendor.email,
        vendor.shopify_vendor_name,
        vendor.city,
        vendor.country,
        vendor.status
      ].some((value) => String(value ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search vendors by company, email, contact or status..."
          className="focus-ring w-full rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-sm"
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Commission</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredRows.map((vendor) => (
              <tr key={vendor.id} className="hover:bg-panel/70">
                <td className="px-4 py-3">
                  <Link className="font-medium hover:underline" href={`/admin/vendors/${vendor.id}`}>
                    {vendor.company_name}
                  </Link>
                  {vendor.contact_name && <div className="mt-1 text-xs text-slate-500">{vendor.contact_name}</div>}
                </td>
                <td className="px-4 py-3">{vendor.email}</td>
                <td className="px-4 py-3">{vendor.commission_rate ?? 0}%</td>
                <td className="px-4 py-3"><StatusBadge status={vendor.status} /></td>
                <td className="px-4 py-3 text-right"><DeleteVendorButton vendorId={vendor.id} vendorName={vendor.company_name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredRows.length && <div className="p-8 text-center text-sm text-slate-500">No vendors found.</div>}
      </div>
    </div>
  );
}
