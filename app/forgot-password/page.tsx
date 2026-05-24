"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    await supabase.auth.resetPasswordForEmail(String(formData.get("email") ?? ""), {
      redirectTo: `${appUrl}/reset-password`
    });
    setLoading(false);
    setSent(true);
    toast.success("If an account exists for this email, a password reset link has been sent.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form action={submit} className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-500">Enter your email and we will send a password reset link if the account exists.</p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-100 p-4 text-sm font-medium text-emerald-800">
            If an account exists for this email, a password reset link has been sent.
          </div>
        ) : (
          <label className="mt-6 block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input name="email" type="email" required className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" />
          </label>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-ink">Back to login</Link>
          {!sent && (
            <button disabled={loading} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60">
              {loading ? "Sending..." : "Send reset link"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
