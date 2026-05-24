import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { isValidShopDomain, requiredShopifyEnv } from "@/lib/shopify-oauth";

export async function GET() {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;

  try {
    const { shop, clientId, scopes, appUrl } = requiredShopifyEnv();
    if (!isValidShopDomain(shop)) {
      return NextResponse.json({ error: "Invalid SHOPIFY_STORE_DOMAIN. Expected your-store.myshopify.com." }, { status: 400 });
    }

    const state = crypto.randomBytes(24).toString("hex");
    const callbackUrl = `${appUrl}/api/shopify/callback`;
    const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("scope", scopes);
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizeUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set("shopify_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl.startsWith("https://"),
      path: "/api/shopify",
      maxAge: 10 * 60
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Shopify install failed." }, { status: 400 });
  }
}
