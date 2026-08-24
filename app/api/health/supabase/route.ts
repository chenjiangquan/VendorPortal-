import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;
export const preferredRegion = "lhr1";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase environment variables are not configured.",
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey)
      },
      { status: 500 }
    );
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const url = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`
      },
      cache: "no-store",
      signal: controller.signal
    });

    return NextResponse.json(
      {
        ok: response.ok,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
        supabaseHost: new URL(supabaseUrl).hostname
      },
      { status: response.ok ? 200 : 502 }
    );
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        ok: false,
        error: isAbort ? "Supabase health check timed out." : "Supabase health check failed.",
        elapsedMs: Date.now() - startedAt,
        supabaseHost: new URL(supabaseUrl).hostname
      },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
