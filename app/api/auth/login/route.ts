import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 15;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email and password." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await withTimeout(
    supabase.auth.signInWithPassword(parsed.data),
    12000,
    "Login request timed out. Please try again."
  );

  if (error) {
    return NextResponse.json({ error: error.message || "Could not sign in." }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) } as T;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
