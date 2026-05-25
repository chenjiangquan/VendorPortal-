import { DashboardShell } from "@/components/layout/DashboardShell";

export default function AdminProductsLoading() {
  return (
    <DashboardShell role="admin" title="Products">
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-10 w-32 animate-pulse rounded-xl bg-slate-200" />)}
      </div>
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="h-12 bg-panel" />
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="grid grid-cols-6 gap-4 border-t border-line px-4 py-4">
              {Array.from({ length: 6 }).map((__, cellIndex) => <div key={cellIndex} className="h-4 animate-pulse rounded bg-slate-200" />)}
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
