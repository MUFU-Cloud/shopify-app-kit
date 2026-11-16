import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchActiveSubscription, PARTNER_API_VERSION } from "../dist/index.js";

const shopGid = "gid://shopify/Shop/7";

function setup(respond) {
  const requests = [];
  const config = {
    orgId: "123",
    accessToken: "secret",
    appGid: "gid://shopify/App/9",
    fetch: async (url, init) => {
      requests.push({ url, init });
      return respond();
    },
  };
  return { config, requests };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("sends the activeSubscription query", async () => {
  const { config, requests } = setup(() => json({ data: { activeSubscription: null } }));
  await fetchActiveSubscription(config, shopGid);
  const [{ url, init }] = requests;
  assert.equal(url, `https://partners.shopify.com/123/api/${PARTNER_API_VERSION}/graphql.json`);
  assert.equal(init.method, "POST");
  assert.equal(init.headers["X-Shopify-Access-Token"], "secret");
  const body = JSON.parse(init.body);
  assert.match(body.query, /activeSubscription\(appId: \$appId, shopId: \$shopId\)/);
  assert.deepEqual(body.variables, { appId: "gid://shopify/App/9", shopId: shopGid });
});

test("uses apiVersion when given", async () => {
  const { config, requests } = setup(() => json({ data: { activeSubscription: null } }));
  await fetchActiveSubscription({ ...config, apiVersion: "2025-01" }, shopGid);
  assert.equal(requests[0].url, "https://partners.shopify.com/123/api/2025-01/graphql.json");
});

test("returns null without a subscription", async () => {
  const { config } = setup(() => json({ data: { activeSubscription: null } }));
  assert.equal(await fetchActiveSubscription(config, shopGid), null);
});

test("returns the subscription items", async () => {
  const items = [{ handle: "pro", description: "Pro" }];
  const { config } = setup(() => json({ data: { activeSubscription: { items } } }));
  assert.deepEqual(await fetchActiveSubscription(config, shopGid), items);
});

test("throws on HTTP errors", async () => {
  const { config } = setup(() => json({ errors: "Unauthorized" }, 401));
  await assert.rejects(fetchActiveSubscription(config, shopGid), /401/);
});

test("throws on GraphQL errors", async () => {
  const { config } = setup(() => json({ errors: [{ message: "Invalid app" }] }));
  await assert.rejects(fetchActiveSubscription(config, shopGid), /Invalid app/);
});

test("throws on a non-JSON response", async () => {
  const { config } = setup(() => new Response("<html>", { status: 200 }));
  await assert.rejects(fetchActiveSubscription(config, shopGid), /activeSubscription failed/);
});

test("falls back to the global fetch", async (t) => {
  const realFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
  });
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return json({ data: { activeSubscription: null } });
  };
  const { fetch, ...config } = setup(() => null).config;
  assert.equal(await fetchActiveSubscription(config, shopGid), null);
  assert.equal(called, true);
});
