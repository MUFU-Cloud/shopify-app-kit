export const PARTNER_API_VERSION = "2026-10";

export interface PartnerApiConfig {
  orgId: string;
  accessToken: string;
  appGid: string;
  apiVersion?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface SubscriptionItem {
  handle: string | null;
  description: string | null;
}

export function partnerApiConfigFromEnv(env: Record<string, string | undefined> = process.env): PartnerApiConfig | null {
  const orgId = env.SHOPIFY_PARTNER_ORG_ID;
  const accessToken = env.SHOPIFY_PARTNER_API_ACCESS_TOKEN;
  const appGid = env.SHOPIFY_APP_GID;
  return orgId && accessToken && appGid ? { orgId, accessToken, appGid } : null;
}

// null = no subscription. Throws on API errors.
export async function fetchActiveSubscription(config: PartnerApiConfig, shopGid: string): Promise<SubscriptionItem[] | null> {
  const version = config.apiVersion ?? PARTNER_API_VERSION;
  const doFetch = config.fetch ?? fetch;
  const res = await doFetch(`https://partners.shopify.com/${config.orgId}/api/${version}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.accessToken,
    },
    body: JSON.stringify({
      query: `query ActiveSubscription($appId: ID!, $shopId: ID!) {
        activeSubscription(appId: $appId, shopId: $shopId) { items { handle description } }
      }`,
      variables: { appId: config.appGid, shopId: shopGid },
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? 8000),
  });

  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json || json.errors) {
    throw new Error(`activeSubscription failed: ${res.status} ${JSON.stringify(json?.errors ?? null)}`);
  }
  const sub = json.data?.activeSubscription;
  return sub ? (sub.items ?? []) : null;
}
