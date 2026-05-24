import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function DashboardShell({ role, title, children }: { role: "admin" | "vendor"; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-panel">
      <Sidebar role={role} />
      <div className="md:pl-64">
        <Topbar title={title} role={role} />
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
