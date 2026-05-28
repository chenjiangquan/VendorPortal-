import { cn } from "@/lib/utils";

export function StatCard({ label, value, tone = "default" }: { label: React.ReactNode; value: string | number; tone?: "default" | "amber" | "green" }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-white p-6 shadow-sm", tone === "amber" && "border-amber-200", tone === "green" && "border-emerald-200")}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}
