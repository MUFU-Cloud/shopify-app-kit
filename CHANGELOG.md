# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). While the version is 0.x, breaking changes
bump the minor version.

## [0.2.0] - Unreleased

### Changed

- Pro plans are matched by subscription handle. The description no longer vetoes a match, so a plan
  described as "free trial" is no longer read as Free.
- `setMetafields` returns the `userErrors` and sends metafields in chunks of 25.
- `ensureWebPixel` checks the errors of the update mutation, not only of the create.
- `subscribeToKlaviyo` sets explicit email marketing consent, has a timeout and returns `false` on
  network errors instead of throwing.

### Added

- `proPlans` option on `checkIsPro`, and `isProSubscriptionItem`.
- `createMemoryPlanCache`, plus `cache` and `refresh` options on `checkIsPro`.
- `deleteMetafields`.
- Optional `logger` on the admin helpers and `subscribeToKlaviyo`.
- `splitByPlanLimit` for Free plan limits.
- Hydration-safe formatting: `formatNumber`, `formatMoney`, `formatPercent`, `formatUtcDateTime`,
  `formatUtcDate`.
- `exports["./package.json"]`.
- CI on Node 20.19 and 22.

## [0.1.0] - 2026-11-16

### Added

- Plan checks with Shopify App Pricing (Partner API) and an optional Billing API fallback.
- Admin API helpers: shop id, metafields, discount code lookup, revenue web pixel.
- Klaviyo signup with the public key.

[0.2.0]: https://github.com/MUFU-Cloud/shopify-app-kit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MUFU-Cloud/shopify-app-kit/releases/tag/v0.1.0
