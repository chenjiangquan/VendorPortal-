import { StatusBadge } from "@/components/ui/StatusBadge";

export function TrackingStatusBadge({ status }: { status?: string | null }) {
  return <StatusBadge status={status} />;
}
