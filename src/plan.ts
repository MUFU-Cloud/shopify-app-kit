import { fetchActiveSubscription, partnerApiConfigFromEnv, type PartnerApiConfig, type SubscriptionItem } from "./partner-api.js";
import type { PlanCache } from "./plan-cache.js";

// Free plan also has an active $0 subscription, and paid plans are $0 on dev stores.
export const isProPlanName = (name: string | undefined | null): boolean => Boolean(name) && !/free/i.test(name as string);

const matchesPlan = (name: string | undefined | null, plans: readonly string[]): boolean =>
  Boolean(name) && plans.some((p) => p.toLowerCase() === (name as string).toLowerCase());

export function isProSubscriptionItem(item: SubscriptionItem, proPlans?: readonly string[]): boolean {
  const name = item.handle ?? item.description;
  return proPlans ? matchesPlan(name, proPlans) : isProPlanName(name);
}

export interface BillingCheck {
  check: () => Promise<any>;
}

export interface CheckIsProOptions {
  billing: BillingCheck;
  shopGid: string;
  lastKnown: boolean;
  partnerApi?: PartnerApiConfig | null;
  legacyBilling?: boolean;
  proPlans?: readonly string[];
  cache?: PlanCache;
  refresh?: boolean;
  env?: Record<string, string | undefined>;
  logger?: Pick<Console, "error">;
}

export async function checkIsPro(options: CheckIsProOptions): Promise<boolean> {
  const { shopGid, lastKnown, cache, refresh = false, env = process.env } = options;

  const forced = env.NODE_ENV !== "production" ? env.DEV_FORCE_PLAN : undefined;
  if (forced === "pro" || forced === "free") return forced === "pro";

  if (cache && !refresh) {
    const cached = cache.get(shopGid);
    if (cached !== undefined) return cached;
  }

  const isPro = await lookupPlan(options, env);
  // undefined = a lookup failed; don't downgrade and don't cache
  if (isPro === undefined) return lastKnown;
  cache?.set(shopGid, isPro);
  return isPro;
}

async function lookupPlan(options: CheckIsProOptions, env: Record<string, string | undefined>): Promise<boolean | undefined> {
  const { billing, shopGid, legacyBilling = false, proPlans, logger = console } = options;
  const partnerApi = options.partnerApi === undefined ? partnerApiConfigFromEnv(env) : options.partnerApi;

  let failed = false;

  if (partnerApi) {
    try {
      const items = await fetchActiveSubscription(partnerApi, shopGid);
      if (items?.some((i) => isProSubscriptionItem(i, proPlans))) return true;
    } catch (e) {
      logger.error("Partner API plan check failed", e);
      failed = true;
    }
    if (!legacyBilling) return failed ? undefined : false;
  }

  try {
    const result = await billing.check();
    const subs: { name?: string; status?: string }[] = result?.appSubscriptions ?? [];
    const isProName = (name?: string) => (proPlans ? matchesPlan(name, proPlans) : isProPlanName(name));
    if (subs.some((s) => (!s.status || s.status === "ACTIVE") && isProName(s.name))) return true;
  } catch (e) {
    logger.error("billing.check failed", e);
    failed = true;
  }

  return failed ? undefined : false;
}
