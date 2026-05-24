import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidShopDomain, normalizeShopDomain, requiredShopifyEnv, verifyShopifyOAuthHmac } from "@/lib/shopify-oauth";

type ShopifyTokenResponse = {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  try {
    const { clientId, clientSecret, appUrl } = requiredShopifyEnv();
    const cookieStore = await cookies();
    const expectedState = cookieStore.get("shopify_oauth_state")?.value;
    const state = searchParams.get("state");
    const shop = normalizeShopDomain(searchParams.get("shop") ?? "");
    const code = searchParams.get("code");

    if (!expectedState || !state || expectedState !== state) {
      return NextResponse.json({ error: "Invalid Shopify OAuth state." }, { status: 400 });
    }
    if (!shop || !isValidShopDomain(shop)) {
      return NextResponse.json({ error: "Invalid Shopify shop domain." }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "Missing Shopify authorization code." }, { status: 400 });
    }
    if (!verifyShopifyOAuthHmac(searchParams, clientSecret)) {
      return NextResponse.json({ error: "Invalid Shopify OAuth hmac." }, { status: 400 });
    }

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      cache: "no-store"
    });
    const tokenJson = (await tokenRes.json()) as ShopifyTokenResponse;
    if (!tokenRes.ok || !tokenJson.access_token) {
      return NextResponse.json({ error: tokenJson.error_description ?? tokenJson.error ?? "Shopify token exchange failed." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error: saveError } = await supabase.from("app_settings").upsert({
      key: "shopify_access_token",
      value: {
        shop,
        access_token: tokenJson.access_token,
        scope: tokenJson.scope,
        installed_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    });
    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 400 });
    }

    const response = NextResponse.redirect(`${appUrl}/admin/settings?shopify=connected`);
    response.cookies.set("shopify_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl.startsWith("https://"),
      path: "/api/shopify",
      maxAge: 0
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Shopify callback failed." }, { status: 400 });
  }
}
