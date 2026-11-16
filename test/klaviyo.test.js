import { test } from "node:test";
import assert from "node:assert/strict";
import { subscribeToKlaviyo, KLAVIYO_REVISION } from "../dist/index.js";

const quiet = { error() {}, warn() {} };
const base = { publicKey: "PUB KEY", listId: "L1", email: "a@example.com", source: "BMI calculator", logger: quiet };

test("sends a client subscription with email marketing consent", async () => {
  let req;
  const ok = await subscribeToKlaviyo({
    ...base,
    properties: { bmi: "22.1" },
    fetch: async (url, init) => {
      req = { url, init };
      return new Response(null, { status: 202 });
    },
  });
  assert.equal(ok, true);
  assert.equal(req.url, "https://a.klaviyo.com/client/subscriptions/?company_id=PUB%20KEY");
  assert.equal(req.init.method, "POST");
  assert.equal(req.init.headers.revision, KLAVIYO_REVISION);
  assert.equal(req.init.headers["Content-Type"], "application/vnd.api+json");
  assert.ok(req.init.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(req.init.body), {
    data: {
      type: "subscription",
      attributes: {
        custom_source: "BMI calculator",
        profile: {
          data: {
            type: "profile",
            attributes: {
              email: "a@example.com",
              properties: { bmi: "22.1" },
              subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
            },
          },
        },
      },
      relationships: { list: { data: { type: "list", id: "L1" } } },
    },
  });
});

test("non-2xx returns false", async () => {
  const ok = await subscribeToKlaviyo({ ...base, fetch: async () => new Response("bad", { status: 400 }) });
  assert.equal(ok, false);
});

test("network error returns false", async () => {
  const ok = await subscribeToKlaviyo({
    ...base,
    fetch: async () => {
      throw new TypeError("fetch failed");
    },
  });
  assert.equal(ok, false);
});

test("timeout returns false", async () => {
  const ok = await subscribeToKlaviyo({
    ...base,
    timeoutMs: 10,
    // Node 20's AbortSignal.timeout timer doesn't keep the event loop alive
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => {
        const keepAlive = setTimeout(() => {}, 5000);
        init.signal.addEventListener("abort", () => {
          clearTimeout(keepAlive);
          reject(init.signal.reason);
        });
      }),
  });
  assert.equal(ok, false);
});

test("uses global fetch by default", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(null, { status: 202 });
  };
  try {
    assert.equal(await subscribeToKlaviyo(base), true);
    assert.equal(called, true);
  } finally {
    globalThis.fetch = original;
  }
});
