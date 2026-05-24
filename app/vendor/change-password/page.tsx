import { DashboardShell } from "@/components/layout/DashboardShell";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { requireVendor } from "@/lib/auth";

export default async function ChangePasswordPage() {
  await requireVendor();
  return <DashboardShell role="vendor" title="Change Password"><ChangePasswordForm redirectTo="/vendor/settings" /></DashboardShell>;
}
