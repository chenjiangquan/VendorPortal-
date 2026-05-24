"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function change(formData: FormData) {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!currentPassword) {
      toast.error("Current password is required.");
      return;
    }
    if (newPassword.length < 10) {
      toast.error("New password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from current password.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const email = userData.user?.email;

    if (userError || !email) {
      setLoading(false);
      toast.error("Unable to verify current user.");
      return;
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword
    });

    if (verifyError) {
      setLoading(false);
      toast.error("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success("Password updated successfully.");
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form action={change} className="max-w-xl rounded-2xl border border-line bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel">
          <KeyRound className="h-5 w-5 text-ink" />
        </div>
        <div>
          <h2 className="font-semibold text-ink">Update password</h2>
          <p className="text-sm text-slate-500">Re-enter your current password before setting a new one.</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <Field name="currentPassword" label="Current password" autoComplete="current-password" />
        <Field name="newPassword" label="New password" autoComplete="new-password" minLength={10} />
        <Field name="confirmPassword" label="Confirm new password" autoComplete="new-password" minLength={10} />
      </div>

      <button disabled={loading} className="mt-6 inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60">
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}

function Field(props: { name: string; label: string; autoComplete: string; minLength?: number }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <input
        name={props.name}
        type="password"
        required
        minLength={props.minLength}
        autoComplete={props.autoComplete}
        className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm"
      />
    </label>
  );
}
