# @mufucloud/shopify-app-kit

[![npm](https://img.shields.io/npm/v/@mufucloud/shopify-app-kit)](https://www.npmjs.com/package/@mufucloud/shopify-app-kit)
[![CI](https://github.com/MUFU-Cloud/shopify-app-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/MUFU-Cloud/shopify-app-kit/actions/workflows/ci.yml)

Server helpers shared by mufucloud's Shopify apps (React Router template): plan checks with Shopify
App Pricing, Admin API helpers, Klaviyo signup, Free plan limits and hydration-safe formatting.
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

## Logging

Helpers that log take an optional `logger` (anything with `error`/`warn`, defaults to `console`):
in the options object for `checkIsPro` and `subscribeToKlaviyo`, and as a trailing `{ logger }` for
the admin helpers, for example `setMetafields(admin, ns, ownerId, fields, { logger })`.

## Versioning

While the version is 0.x, breaking changes bump the minor version (0.2 to 0.3), so use a caret range
(`^0.2.0`) and read the [changelog](CHANGELOG.md) before upgrading. Releases are published to npm from
the `v*` tags by GitHub Actions.

## License

[MIT](LICENSE)
