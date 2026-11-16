import { fetchActiveSubscription, partnerApiConfigFromEnv, type PartnerApiConfig } from "./partner-api.js";

// Free plan also has an active $0 subscription, and paid plans are $0 on dev stores.
export const isProPlanName = (name: string | undefined | null): boolean => Boolean(name) && !/free/i.test(name as string);

export interface BillingCheck {
  check: () => Promise<any>;
}

export interface CheckIsProOptions {
  billing: BillingCheck;
  shopGid: string;
  lastKnown: boolean;
  partnerApi?: PartnerApiConfig | null;
  legacyBilling?: boolean;
  env?: Record<string, string | undefined>;
  logger?: Pick<Console, "error">;
}

export async function checkIsPro(options: CheckIsProOptions): Promise<boolean> {
  const { billing, shopGid, lastKnown, legacyBilling = false, env = process.env, logger = console } = options;
  const partnerApi = options.partnerApi === undefined ? partnerApiConfigFromEnv(env) : options.partnerApi;

  const forced = env.NODE_ENV !== "production" ? env.DEV_FORCE_PLAN : undefined;
  if (forced === "pro" || forced === "free") return forced === "pro";

  let failed = false;

  if (partnerApi) {
    try {
      const items = await fetchActiveSubscription(partnerApi, shopGid);
      if (items?.some((i) => isProPlanName(i.handle) && isProPlanName(i.description ?? i.handle))) return true;
    } catch (e) {
      logger.error("Partner API plan check failed", e);
      failed = true;
    }
    if (!legacyBilling) return failed ? lastKnown : false;
  }

  try {
    const result = await billing.check();
    const subs: { name?: string; status?: string }[] = result?.appSubscriptions ?? [];
    if (subs.some((s) => (!s.status || s.status === "ACTIVE") && isProPlanName(s.name))) return true;
  } catch (e) {
    logger.error("billing.check failed", e);
    failed = true;
  }

  // don't downgrade on errors
  return failed ? lastKnown : false;
}
