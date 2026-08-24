import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 15;
export const preferredRegion = "lhr1";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email and password." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase login is not configured." }, { status: 500 });
  }

  const authResult = await signInWithSupabaseRest(supabaseUrl, supabaseAnonKey, parsed.data);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const response = NextResponse.json({ success: true });
  setSupabaseSessionCookies(response, supabaseUrl, authResult.session);
  return response;
}

async function signInWithSupabaseRest(
  supabaseUrl: string,
  supabaseAnonKey: string,
  credentials: { email: string; password: string }
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(credentials),
      signal: controller.signal
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status === 400 ? 401 : response.status,
        error: json.error_description || json.msg || json.error || "Could not sign in."
      };
    }

    return {
      ok: true as const,
      session: {
        ...json,
        expires_at: json.expires_at ?? Math.floor(Date.now() / 1000) + Number(json.expires_in ?? 3600)
      }
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      ok: false as const,
      status: 504,
      error: isAbort ? "Login request timed out. Please try again." : "Login request failed. Please try again."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function setSupabaseSessionCookies(response: NextResponse, supabaseUrl: string, session: unknown) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  const cookieOptions = {
    path: "/",
    sameSite: "lax" as const,
    secure: true,
    maxAge: 34560000
  };

  for (let index = 0; index < 6; index += 1) {
    response.cookies.set(`${cookieName}.${index}`, "", { ...cookieOptions, maxAge: 0 });
  }

  if (cookieValue.length <= 3180) {
    response.cookies.set(cookieName, cookieValue, cookieOptions);
    return;
  }

  response.cookies.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
  const chunks = cookieValue.match(/.{1,3180}/g) ?? [];
  chunks.forEach((chunk, index) => {
    response.cookies.set(`${cookieName}.${index}`, chunk, cookieOptions);
  });
}
