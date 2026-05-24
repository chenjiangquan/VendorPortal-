import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  shopify_draft: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-100 text-slate-600",
  open: "bg-slate-100 text-slate-700",
  tracking_submitted: "bg-amber-100 text-amber-800",
  reviewed: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
  cancelled: "bg-red-100 text-red-800"
};

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const value = status ?? "unknown";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", styles[value] ?? styles.draft, className)}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
