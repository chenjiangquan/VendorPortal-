"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const credentials = {
      email: String(formData.get("email")),
      password: String(formData.get("password"))
    };
    setLoading(true);
    const result = await signIn(credentials);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Signed in.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form onSubmit={login} className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-semibold text-ink">Vendor Portal</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in with the credentials provided by the platform admin.</p>
        {search.get("suspended") && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">This vendor account is suspended or inactive.</div>}
        <div className="mt-6 space-y-4">
          <label className="block"><span className="text-sm font-medium">Email</span><input name="email" type="email" required className="focus-ring mt-1 w-full rounded-xl border border-line bg-white px-4 py-2 text-sm shadow-sm" /></label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <div className="relative mt-1">
              <input name="password" type={showPassword ? "text" : "password"} required className="focus-ring w-full rounded-xl border border-line bg-white px-4 py-2 pr-12 text-sm shadow-sm" />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-slate-600 hover:text-ink">Forgot password?</Link>
        </div>
        <button disabled={loading} className="mt-6 w-full rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}

async function signIn(credentials: { email: string; password: string }) {
  const serverResult = await signInWithServerRoute(credentials);
  if (serverResult.ok) {
    return serverResult;
  }

  if (!serverResult.shouldFallback) {
    return serverResult;
  }

  const browserResult = await signInWithBrowserClient(credentials);
  if (browserResult.ok) {
    return browserResult;
  }

  return {
    ok: false as const,
    error: browserResult.error || serverResult.error || "Login failed. Please check your connection and try again."
  };
}

async function signInWithServerRoute(credentials: { email: string; password: string }) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(credentials)
    });
    const json = await response.json().catch(() => ({}));

    if (response.ok) {
      return { ok: true as const };
    }

    return {
      ok: false as const,
      shouldFallback: response.status === 504,
      error: json?.error ?? "Login failed. Please check your connection and try again."
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      ok: false as const,
      shouldFallback: true,
      error: isAbort ? "Login request timed out. Trying another login route..." : "Login request failed. Trying another login route..."
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function signInWithBrowserClient(credentials: { email: string; password: string }) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    return {
      ok: false as const,
      error: error.message || "Could not sign in."
    };
  }
  return { ok: true as const };
}
