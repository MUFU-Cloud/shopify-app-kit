# @mufucloud/shopify-app-kit

[![npm](https://img.shields.io/npm/v/@mufucloud/shopify-app-kit)](https://www.npmjs.com/package/@mufucloud/shopify-app-kit)
[![CI](https://github.com/MUFU-Cloud/shopify-app-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/MUFU-Cloud/shopify-app-kit/actions/workflows/ci.yml)

Server helpers shared by mufucloud's Shopify apps (React Router template): plan checks with Shopify
App Pricing, Admin API helpers, Klaviyo signup, Free plan limits, hydration-safe formatting, and
request validation for web pixel conversions, lead forms and compliance webhooks.
TypeScript, ESM only, no runtime dependencies.

## Install

```bash
npm install @mufucloud/shopify-app-kit
```

Node 20.19 or newer.

## Environment

| Variable | Value |
|---|---|
| `SHOPIFY_PARTNER_ORG_ID` | the number in the Partner Dashboard URL |
| `SHOPIFY_PARTNER_API_ACCESS_TOKEN` | Partner API client with "Manage apps" |
| `SHOPIFY_APP_GID` | `gid://shopify/App/<id>` |
| `DEV_FORCE_PLAN` | `pro` or `free`, local testing only (ignored when `NODE_ENV=production`) |

Without the three Partner API variables the Billing API (`billing.check()`) decides.

## Plan check

```ts
import { checkIsPro, createMemoryPlanCache, getShopId } from "@mufucloud/shopify-app-kit";

// module level, shared across requests
const planCache = createMemoryPlanCache(); // { ttlMs: 300_000, max: 1000 }

const { admin, billing } = await authenticate.admin(request);
const isPro = await checkIsPro({
  billing,
  shopGid: await getShopId(admin),
  lastKnown: saved?.isPro ?? false,
  cache: planCache,
});
```

How the plan is decided:

- The Partner API (Active Subscription API) is asked first. A subscription item counts as Pro when
  its handle doesn't contain "free". App Pricing also creates a $0 subscription for the Free plan, and
  paid plans are $0 on dev stores, so price is not used.
- Pass `proPlans: ["pro", "pro-yearly"]` to list the Pro plan handles explicitly instead (case
  insensitive). `isProSubscriptionItem(item, proPlans?)` applies the same rule to a single item.
- `legacyBilling: true` also checks `billing.check()` when the Partner API finds nothing. Use it
  only if the app sold Billing API subscriptions before switching to App Pricing.
- A failed lookup never downgrades a shop: it returns `lastKnown` and nothing is cached.
- With `cache`, results are reused for `ttlMs`. Pass `refresh: true` after a plan change (for example
  in the subscription webhook or on the return from the plan page) to skip the cache and store the
  fresh result.

Other options: `partnerApi` (config object, or `null` to skip the Partner API; defaults to the
environment), `env` (defaults to `process.env`), `logger` (defaults to `console`).

## Metafields

```ts
import { getShopId, setMetafields, deleteMetafields } from "@mufucloud/shopify-app-kit";

const shopId = await getShopId(admin);
const errors = await setMetafields(admin, "my_app", shopId, [
  { key: "app_enabled", type: "boolean", value: "true" },
  { key: "settings", type: "json", value: JSON.stringify(settings) },
]);
await deleteMetafields(admin, "my_app", shopId, ["old_key"]);
```

Both return the `userErrors` (empty on success) and log them. `setMetafields` sends 25 metafields
per request, the `metafieldsSet` limit.

## Web pixel

```ts
import { ensureWebPixel } from "@mufucloud/shopify-app-kit";

const ok = await ensureWebPixel(admin, process.env.SHOPIFY_APP_URL!); // endpoint: <appUrl>/api/conversion
```

Creates the app's web pixel or updates its `endpoint` setting. Returns `false` when it couldn't,
usually because `write_pixels` isn't granted yet. The third argument changes the path.

## Discount codes

```ts
import { checkDiscountCode } from "@mufucloud/shopify-app-kit";

const problem = await checkDiscountCode(admin, "SUMMER10"); // "not_found" | "inactive" | null
```

`null` means the code is fine or couldn't be checked (for example without `read_discounts`).

## Klaviyo

```ts
import { subscribeToKlaviyo } from "@mufucloud/shopify-app-kit";

const ok = await subscribeToKlaviyo({
  publicKey, // the merchant's public (site) key
  listId,
  email,
  source: "My App",
  properties: { lang: "en" },
});
```

Uses the client subscriptions endpoint, so only the public key is needed. The profile is subscribed
with explicit email marketing consent. Returns `false` on HTTP or network errors and on timeout
(`timeoutMs`); it doesn't throw.

## Free plan limit

```ts
import { splitByPlanLimit } from "@mufucloud/shopify-app-kit";

const { live, offline } = splitByPlanLimit(products, {
  isPro,
  limit: 5,
  createdAt: (p) => p.createdAt,
});
```

On Free, the oldest `limit` items stay live and the rest go offline (kept, not deleted). On Pro
everything is live.

## Formatting

Server and browser must render the same text or hydration fails, so these use a fixed locale
(`en-US` by default) and UTC.

```ts
import { formatNumber, formatMoney, formatPercent, formatUtcDateTime, formatUtcDate } from "@mufucloud/shopify-app-kit";

formatNumber(12345.6);                     // "12,345.6"
formatNumber(0.5, { maximumFractionDigits: 0, locale: "de-DE" });
formatMoney(19.9, "EUR");                  // "€19.90"
formatPercent(0.1234);                     // "12.3%"
formatPercent(0.1234, 0);                  // "12%"
formatUtcDateTime("2026-11-16T09:05:00Z"); // "2026-11-16 09:05 UTC"
formatUtcDate(new Date());                 // "2026-11-16"
```

## Request bodies

```ts
import { readJsonObject, clip } from "@mufucloud/shopify-app-kit";

const body = await readJsonObject(request); // null if not JSON, {} if JSON but not an object
if (!body) return new Response("Invalid JSON", { status: 400 });
const locale = clip(body.locale, 16);       // non-empty string cut to 16 chars, or null
```

`readJsonObject` reads the raw text, so it also handles `text/plain` bodies.

## Conversion endpoint

For the public route that receives `checkout_completed` events from the app's web pixel. The pixel
runs in Shopify's sandbox, so the request can't be authenticated: check that the shop has the app
installed and store each order once.

```ts
import { corsResponse, parseConversion, readJsonObject } from "@mufucloud/shopify-app-kit";

export const loader = ({ request }) => (request.method === "OPTIONS" ? corsResponse(204) : corsResponse(405));

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") return corsResponse(204);
  const body = await readJsonObject(request);
  if (!body) return corsResponse(400, "Invalid JSON");
  const conversion = parseConversion(body, { attributedKey: "recommended" });
  if (!conversion) return corsResponse(400, "Invalid payload");
  // { shop, orderId, total, attributed, currency }; look up the shop, then upsert by (shop, orderId)
  return corsResponse(200, "ok");
};
```

The shop must be a `*.myshopify.com` domain, the order id is cut to 128 characters and amounts must
be between 0 and 10,000,000 (`parseMoney`). `attributed` is read from `attributedKey`, defaults to 0
and never exceeds the total. Also exported: `isShopDomain`, `parseMoney`, `CONVERSION_CORS_HEADERS`.

## Lead form

```ts
import { parseLead } from "@mufucloud/shopify-app-kit";

const lead = parseLead(body);
if (!lead.ok) return Response.json({ error: lead.error }, { status: 400 }); // "invalid_email" | "consent_required"
// lead.email is trimmed and lowercased
```

Consent must be exactly `true`. `normalizeEmail` and `isValidEmail` (at most 254 characters) are
exported too.

## Compliance webhooks

```ts
import { customerEmail } from "@mufucloud/shopify-app-kit";

case "CUSTOMERS_REDACT": {
  const email = customerEmail(payload); // trimmed, lowercased, or null
  if (email) await db.lead.deleteMany({ where: { shop, email } });
  break;
}
```

## Translations

```ts
import { baseLanguage, interpolate, parseLocalized, withFallback } from "@mufucloud/shopify-app-kit";

const ADMIN = withFallback({ en, tr, de }); // missing keys come from en, translated ones stay
const lang = baseLanguage(searchParams.get("locale")); // "pt-BR" -> "pt", empty -> "en"
interpolate("{n} of {n} left", { n: 3 });   // "3 of 3 left"

// texts stored per shop locale as JSON, with legacy plain strings
parseLocalized('{"default":"Hi","tr":"Selam"}', "Hello"); // { default: "Hi", tr: "Selam" }
parseLocalized("Hi", "Hello");                            // { default: "Hi" }
parseLocalized(null, "Hello");                            // { default: "Hello" }
```

## Pricing page

```ts
import { pricingPlansUrl } from "@mufucloud/shopify-app-kit";

pricingPlansUrl("demo.myshopify.com", "my-app-handle");
// "https://admin.shopify.com/store/demo/charges/my-app-handle/pricing_plans"
```

## Logging

Helpers that log take an optional `logger` (anything with `error`/`warn`, defaults to `console`):
in the options object for `checkIsPro` and `subscribeToKlaviyo`, and as a trailing `{ logger }` for
the admin helpers, for example `setMetafields(admin, ns, ownerId, fields, { logger })`.

## Versioning

While the version is 0.x, breaking changes bump the minor version (0.3 to 0.4), so use a caret range
(`^0.3.0`) and read the [changelog](CHANGELOG.md) before upgrading. Releases are published to npm from
the `v*` tags by GitHub Actions.

## License

[MIT](LICENSE)
