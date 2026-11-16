import { after, test } from "node:test";
import assert from "node:assert/strict";
import { checkIsPro, createMemoryPlanCache, isProPlanName, isProSubscriptionItem } from "../dist/index.js";

const partnerApi = { orgId: "1", accessToken: "t", appGid: "gid://shopify/App/1" };
const env = { NODE_ENV: "production" };
const quiet = { error() {} };

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

let calls = 0;
function mockFetch(handler) {
  globalThis.fetch = async () => {
    calls++;
    return handler();
  };
}
const partnerReturns = (items) =>
  mockFetch(() => new Response(JSON.stringify({ data: { activeSubscription: items ? { items } : null } }), { status: 200 }));
const billing = (subs, fail = false) => ({
  check: async () => {
    if (fail) throw new Error("boom");
    return { appSubscriptions: subs };
  },
});
const base = { shopGid: "gid://shopify/Shop/1", partnerApi, env, logger: quiet };

test("isProPlanName", () => {
  assert.equal(isProPlanName("Pro"), true);
  assert.equal(isProPlanName("Free"), false);
  assert.equal(isProPlanName("free-plan"), false);
  assert.equal(isProPlanName(null), false);
});

test("Partner API Pro plan is Pro", async () => {
  partnerReturns([{ handle: "pro", description: "Pro" }]);
  assert.equal(await checkIsPro({ ...base, billing: billing([]), lastKnown: false }), true);
});

test("Partner API Free plan is not Pro", async () => {
  partnerReturns([{ handle: "free", description: "Free" }]);
  assert.equal(await checkIsPro({ ...base, billing: billing([{ name: "Pro", status: "ACTIVE" }]), lastKnown: true }), false);
});

test("legacyBilling: Billing API subscription counts when Partner API has none", async () => {
  partnerReturns(null);
  const b = billing([{ name: "Pro", status: "ACTIVE" }]);
  assert.equal(await checkIsPro({ ...base, billing: b, lastKnown: false, legacyBilling: true }), true);
  assert.equal(await checkIsPro({ ...base, billing: b, lastKnown: false }), false);
});

test("a failed Partner API call keeps the last known plan", async () => {
  mockFetch(() => new Response("nope", { status: 500 }));
  assert.equal(await checkIsPro({ ...base, billing: billing([]), lastKnown: true }), true);
  assert.equal(await checkIsPro({ ...base, billing: billing([]), lastKnown: true, legacyBilling: true }), true);
  assert.equal(await checkIsPro({ ...base, billing: billing([]), lastKnown: false }), false);
});

test("without Partner API credentials the Billing API decides", async () => {
  const opts = { ...base, partnerApi: null, lastKnown: true };
  assert.equal(await checkIsPro({ ...opts, billing: billing([{ name: "Pro", status: "CANCELLED" }]) }), false);
  assert.equal(await checkIsPro({ ...opts, billing: billing([], true) }), true);
});

test("DEV_FORCE_PLAN only outside production", async () => {
  partnerReturns(null);
  const opts = { ...base, billing: billing([]), lastKnown: false };
  assert.equal(await checkIsPro({ ...opts, env: { NODE_ENV: "development", DEV_FORCE_PLAN: "pro" } }), true);
  assert.equal(await checkIsPro({ ...opts, env: { NODE_ENV: "production", DEV_FORCE_PLAN: "pro" } }), false);
});

test("isProSubscriptionItem goes by handle, not description", () => {
  assert.equal(isProSubscriptionItem({ handle: "pro", description: "Pro, 7-day free trial" }), true);
  assert.equal(isProSubscriptionItem({ handle: "free", description: "Free" }), false);
  assert.equal(isProSubscriptionItem({ handle: null, description: "Pro" }), true);
  assert.equal(isProSubscriptionItem({ handle: null, description: "Free" }), false);
  assert.equal(isProSubscriptionItem({ handle: null, description: null }), false);
});

test("isProSubscriptionItem with proPlans", () => {
  const plans = ["pro", "Business"];
  assert.equal(isProSubscriptionItem({ handle: "PRO", description: "Free trial" }, plans), true);
  assert.equal(isProSubscriptionItem({ handle: "business", description: null }, plans), true);
  assert.equal(isProSubscriptionItem({ handle: "starter", description: "Starter" }, plans), false);
  assert.equal(isProSubscriptionItem({ handle: null, description: "Business" }, plans), true);
});

test("Pro plan with a free trial in its description is Pro", async () => {
  partnerReturns([{ handle: "pro", description: "Pro with 7-day free trial" }]);
  assert.equal(await checkIsPro({ ...base, billing: billing([]), lastKnown: false }), true);
});

test("proPlans applies to Partner API and Billing API", async () => {
  partnerReturns([{ handle: "starter", description: "Starter" }]);
  const opts = { ...base, billing: billing([]), lastKnown: false, proPlans: ["pro"] };
  assert.equal(await checkIsPro(opts), false);
  partnerReturns([{ handle: "Pro", description: "Pro" }]);
  assert.equal(await checkIsPro(opts), true);

  const legacy = { ...base, partnerApi: null, lastKnown: false, proPlans: ["Pro Monthly"] };
  assert.equal(await checkIsPro({ ...legacy, billing: billing([{ name: "pro monthly", status: "ACTIVE" }]) }), true);
  assert.equal(await checkIsPro({ ...legacy, billing: billing([{ name: "Starter", status: "ACTIVE" }]) }), false);
});

test("cache hit skips the API, refresh bypasses it", async () => {
  const cache = createMemoryPlanCache();
  partnerReturns([{ handle: "pro", description: "Pro" }]);
  const opts = { ...base, billing: billing([]), lastKnown: false, cache };
  calls = 0;
  assert.equal(await checkIsPro(opts), true);
  assert.equal(await checkIsPro(opts), true);
  assert.equal(calls, 1);

  partnerReturns([{ handle: "free", description: "Free" }]);
  assert.equal(await checkIsPro(opts), true);
  assert.equal(await checkIsPro({ ...opts, refresh: true }), false);
  assert.equal(await checkIsPro(opts), false);
  assert.equal(calls, 2);
});

test("failed checks are not cached", async () => {
  const cache = createMemoryPlanCache();
  mockFetch(() => new Response("nope", { status: 500 }));
  const opts = { ...base, billing: billing([]), lastKnown: true, cache };
  assert.equal(await checkIsPro(opts), true);
  assert.equal(cache.get(base.shopGid), undefined);

  partnerReturns(null);
  assert.equal(await checkIsPro(opts), false);
  assert.equal(cache.get(base.shopGid), false);
});

test("DEV_FORCE_PLAN wins over the cache and is not cached", async () => {
  const cache = createMemoryPlanCache();
  cache.set(base.shopGid, false);
  const env = { NODE_ENV: "development", DEV_FORCE_PLAN: "pro" };
  assert.equal(await checkIsPro({ ...base, env, billing: billing([]), lastKnown: false, cache }), true);
  assert.equal(cache.get(base.shopGid), false);
});
