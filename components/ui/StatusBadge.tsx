import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  shopify_draft: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-100 text-slate-600",
  update_pending: "bg-violet-100 text-violet-800",
  delete_pending: "bg-rose-100 text-rose-800",
  request_approved: "bg-emerald-100 text-emerald-800",
  request_rejected: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
  open: "bg-slate-100 text-slate-700",
  tracking_submitted: "bg-amber-100 text-amber-800",
  reviewed: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
  cancelled: "bg-red-100 text-red-800"
};

export function StatusBadge({ status, label, className }: { status?: string | null; label?: string; className?: string }) {
  const value = status ?? "unknown";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", styles[value] ?? styles.draft, className)}>
      {label ?? value.replaceAll("_", " ")}
    </span>
  );
}
