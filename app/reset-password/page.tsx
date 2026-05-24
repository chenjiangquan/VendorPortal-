"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-panel px-4">Loading...</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < 10) {
      toast.error("Password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated successfully. Please sign in.");
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form action={submit} className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">Create a new password</h1>
        <p className="mt-2 text-sm text-slate-500">Choose a new password with at least 10 characters.</p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">New password</span>
            <input name="newPassword" type="password" required minLength={10} autoComplete="new-password" className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Confirm password</span>
            <input name="confirmPassword" type="password" required minLength={10} autoComplete="new-password" className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-ink">Back to login</Link>
          <button disabled={loading} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60">
            {loading ? "Updating..." : "Update password"}
          </button>
        </div>
      </form>
    </main>
  );
}
