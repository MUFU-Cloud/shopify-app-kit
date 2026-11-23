// The shop's admin page for the app's managed pricing plans (Shopify App Pricing).
// `appHandle` is the app's handle in the Partner Dashboard.
export function pricingPlansUrl(shop: string, appHandle: string): string {
  const store = shop.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${encodeURIComponent(store)}/charges/${encodeURIComponent(appHandle)}/pricing_plans`;
}
