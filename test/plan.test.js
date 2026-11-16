import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIsPro, isProPlanName } from "../dist/index.js";

const partnerApi = { orgId: "1", accessToken: "t", appGid: "gid://shopify/App/1" };
const env = { NODE_ENV: "production" };
const quiet = { error() {} };

function mockFetch(handler) {
  globalThis.fetch = async () => handler();
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
