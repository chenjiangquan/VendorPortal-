"use client";

import { useState } from "react";
import { ProductChangeDiff } from "@/lib/product-diff";

export function ProductChangeDiffPanel({ diff }: { diff: ProductChangeDiff }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const fields = showUnchanged ? diff.fields : diff.fields.filter((field) => field.changed);

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Proposed changes</h3>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
          <input type="checkbox" checked={showUnchanged} onChange={(event) => setShowUnchanged(event.target.checked)} className="h-4 w-4 rounded border-line" />
          Show unchanged fields
        </label>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Current</th>
              <th className="px-3 py-2">Proposed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {fields.map((field) => (
              <tr key={field.field} className={field.changed ? "bg-red-50/50" : ""}>
                <td className="px-3 py-2 font-medium text-ink">{field.label}</td>
                <td className="px-3 py-2 text-slate-600">{field.before}</td>
                <td className={`px-3 py-2 ${field.changed ? "font-semibold text-red-700" : "text-slate-900"}`}>{field.after}</td>
              </tr>
            ))}
            {!fields.length && <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">No field changes.</td></tr>}
          </tbody>
        </table>
      </div>

      <CollectionDiff title="Details Table" rows={diff.details} />
      <CollectionDiff title="Variants" rows={diff.variants} />
      <CollectionDiff title="Images" rows={diff.images} />
    </section>
  );
}

function CollectionDiff({ title, rows }: { title: string; rows: ProductChangeDiff["details"] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      <div className="mt-2 overflow-hidden rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Change</th>
              <th className="px-3 py-2">Current</th>
              <th className="px-3 py-2">Proposed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`} className="bg-red-50/50 align-top">
                <td className="px-3 py-2 font-medium text-ink">{row.label}</td>
                <td className="whitespace-pre-wrap px-3 py-2 text-slate-600">{row.before}</td>
                <td className="whitespace-pre-wrap px-3 py-2 font-semibold text-red-700">{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
