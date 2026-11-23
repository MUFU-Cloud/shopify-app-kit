// Helpers for the public endpoint that receives checkout_completed events from an app's web pixel
// (see ensureWebPixel). The pixel runs in Shopify's sandbox, so the endpoint can't authenticate the
// request: accept only shops that have the app installed, ignore duplicate orders and clamp values.

export const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export const isShopDomain = (value: unknown): value is string => typeof value === "string" && SHOP_DOMAIN_RE.test(value);

export const MAX_ORDER_AMOUNT = 10_000_000;

// A non-negative amount below `max`, rounded to cents, or null. Accepts numbers and numeric strings.
export function parseMoney(value: unknown, max: number = MAX_ORDER_AMOUNT): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) && n >= 0 && n < max ? Math.round(n * 100) / 100 : null;
}

export const CONVERSION_CORS_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// A response with the CORS headers. 204 never has a body (passing "" throws in undici).
export const corsResponse = (status: number, body: string | null = null): Response =>
  new Response(status === 204 ? null : body, { status, headers: CONVERSION_CORS_HEADERS });

export interface Conversion {
  shop: string;
  orderId: string;
  total: number;
  // the part of the order the app takes credit for, never more than the total
  attributed: number;
  currency: string | null;
}

// Validates a pixel payload: { shop, orderId, total, currency, [attributedKey] }.
// Returns null when the shop, order id or total is missing or invalid.
export function parseConversion(body: Record<string, unknown>, options: { attributedKey: string }): Conversion | null {
  const shop = typeof body.shop === "string" ? body.shop.toLowerCase() : "";
  const orderId = typeof body.orderId === "string" ? body.orderId.slice(0, 128) : "";
  const total = parseMoney(body.total);
  if (!isShopDomain(shop) || !orderId || total === null) return null;
  return {
    shop,
    orderId,
    total,
    attributed: Math.min(parseMoney(body[options.attributedKey]) ?? 0, total),
    currency: typeof body.currency === "string" && body.currency ? body.currency.slice(0, 8) : null,
  };
}
