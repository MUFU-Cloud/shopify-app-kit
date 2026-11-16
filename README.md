# @mufucloud/shopify-app-kit

Server helpers shared by mufucloud's Shopify apps (React Router template):

- **Plan checks with Shopify App Pricing.** Reads the shop's plan from the Partner API (Active
  Subscription API), with an optional Billing API fallback for subscriptions sold before the switch.
  A failed check never downgrades a shop.
- **Admin API helpers:** shop id, metafields, discount code lookup, revenue web pixel.
- **Klaviyo signup** with the merchant's public key only.

## Install

```bash
npm install @mufucloud/shopify-app-kit
```

## Plan check

```ts
import { checkIsPro } from "@mufucloud/shopify-app-kit";

const { admin, billing } = await authenticate.admin(request);
const isPro = await checkIsPro({
  billing,
  shopGid: await getShopId(admin),
  lastKnown: saved?.isPro ?? false,
  legacyBilling: true, // only if the app sold Billing API subscriptions before App Pricing
});
```

Environment:

| Variable | Value |
|---|---|
| `SHOPIFY_PARTNER_ORG_ID` | the number in the Partner Dashboard URL |
| `SHOPIFY_PARTNER_API_ACCESS_TOKEN` | Partner API client with "Manage apps" |
| `SHOPIFY_APP_GID` | `gid://shopify/App/<id>` |
| `DEV_FORCE_PLAN` | `pro` or `free`, local testing only (ignored in production) |

Without the Partner API variables the Billing API (`billing.check()`) decides. Any plan whose name
doesn't contain "free" counts as Pro, because App Pricing also creates a $0 subscription for the
Free plan and paid plans are $0 on dev stores.

## Admin helpers

```ts
import { getShopId, setMetafields, ensureWebPixel, checkDiscountCode } from "@mufucloud/shopify-app-kit";

await setMetafields(admin, "my_app", await getShopId(admin), [
  { key: "app_enabled", type: "boolean", value: "true" },
]);
await ensureWebPixel(admin, process.env.SHOPIFY_APP_URL!); // posts to /api/conversion
await checkDiscountCode(admin, "SUMMER10"); // "not_found" | "inactive" | null
```

## Klaviyo

```ts
import { subscribeToKlaviyo } from "@mufucloud/shopify-app-kit";

await subscribeToKlaviyo({ publicKey, listId, email, source: "My App", properties: { lang: "en" } });
```

## License

MIT
