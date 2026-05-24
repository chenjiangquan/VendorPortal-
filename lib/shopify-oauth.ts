import crypto from "crypto";

export type ShopifyTokenSetting = {
  shop: string;
  access_token: string;
  scope?: string;
  installed_at?: string;
};

export function normalizeShopDomain(shop: string) {
  return shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function isValidShopDomain(shop: string) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalizeShopDomain(shop));
}

export function verifyShopifyOAuthHmac(searchParams: URLSearchParams, secret: string) {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const pairs: string[] = [];
  searchParams.forEach((value, key) => {
    if (key !== "hmac" && key !== "signature") {
      pairs.push(`${key}=${value}`);
    }
  });

  const message = pairs.sort().join("&");
  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const digestBuffer = Buffer.from(digest, "utf8");
  const hmacBuffer = Buffer.from(hmac, "utf8");

  return digestBuffer.length === hmacBuffer.length && crypto.timingSafeEqual(digestBuffer, hmacBuffer);
}

export function requiredShopifyEnv() {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const scopes = process.env.SHOPIFY_SCOPES;
  const appUrl = process.env.SHOPIFY_APP_URL;

  if (!shop || !clientId || !clientSecret || !scopes || !appUrl) {
    throw new Error("Missing Shopify OAuth environment variables.");
  }

  return {
    shop: normalizeShopDomain(shop),
    clientId,
    clientSecret,
    scopes,
    appUrl: appUrl.replace(/\/$/, "")
  };
}
