"use client";

import { TranslationKey, useI18n } from "@/lib/i18n";
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

const labels: Record<string, TranslationKey> = {
  draft: "status.draft",
  submitted: "status.submitted",
  approved: "status.approved",
  rejected: "status.rejected",
  shopify_draft: "status.live",
  archived: "status.archived",
  update_pending: "status.updatePending",
  delete_pending: "status.deletePending",
  request_approved: "status.requestApproved",
  request_rejected: "status.requestRejected",
  pending: "status.pending",
  open: "status.open",
  tracking_submitted: "status.trackingSubmitted",
  reviewed: "status.reviewed",
  closed: "status.closed",
  cancelled: "status.cancelled",
  active: "status.active",
  suspended: "status.suspended"
};

export function StatusBadge({ status, label, className }: { status?: string | null; label?: string; className?: string }) {
  const { t } = useI18n();
  const value = status ?? "unknown";
  const translatedLabel = labels[value] ? t(labels[value]) : value.replaceAll("_", " ");

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", styles[value] ?? styles.draft, className)}>
      {label ?? translatedLabel}
    </span>
  );
}
