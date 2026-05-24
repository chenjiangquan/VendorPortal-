"use client";

import { Suspense } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-panel px-4">Loading...</main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function login(formData: FormData) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password"))
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form action={login} className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">Vendor Portal</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in with the credentials provided by the platform admin.</p>
        {search.get("suspended") && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">This vendor account is suspended or inactive.</div>}
        <div className="mt-6 space-y-4">
          <label className="block"><span className="text-sm font-medium">Email</span><input name="email" type="email" required className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" /></label>
          <label className="block"><span className="text-sm font-medium">Password</span><input name="password" type="password" required className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" /></label>
        </div>
        <div className="mt-4 flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-slate-600 hover:text-ink">Forgot password?</Link>
        </div>
        <button disabled={loading} className="mt-6 w-full rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
