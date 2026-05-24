import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { requireRole } from "@/lib/auth";

export default async function AdminChangePasswordPage() {
  await requireRole("admin");
  return (
    <DashboardShell role="admin" title="Change Password">
      <ChangePasswordForm redirectTo="/admin/settings" />
    </DashboardShell>
  );
}
