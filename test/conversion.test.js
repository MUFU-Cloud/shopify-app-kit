import { test } from "node:test";
import assert from "node:assert/strict";
import { CONVERSION_CORS_HEADERS, corsResponse, isShopDomain, parseConversion, parseMoney } from "../dist/index.js";

test("isShopDomain", () => {
  assert.equal(isShopDomain("demo.myshopify.com"), true);
  assert.equal(isShopDomain("my-shop-2.myshopify.com"), true);
  for (const bad of ["evil.com", "demo.myshopify.com.evil.com", "-demo.myshopify.com", "Demo.myshopify.com", "", 42, null]) {
    assert.equal(isShopDomain(bad), false, String(bad));
  }
});

test("parseMoney", () => {
  assert.equal(parseMoney(19.999), 20);
  assert.equal(parseMoney("120.50"), 120.5);
  assert.equal(parseMoney(0), 0);
  assert.equal(parseMoney(-1), null);
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney(Infinity), null);
  assert.equal(parseMoney(null), null);
  assert.equal(parseMoney(undefined), null);
  assert.equal(parseMoney(10_000_000), null);
  assert.equal(parseMoney(500, 100), null);
});

test("corsResponse", async () => {
  const ok = corsResponse(200, "ok");
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "ok");
  for (const [k, v] of Object.entries(CONVERSION_CORS_HEADERS)) assert.equal(ok.headers.get(k), v);

  const empty = corsResponse(204, "ignored");
  assert.equal(empty.status, 204);
  assert.equal(await empty.text(), "");
});

const valid = { shop: "Demo.MyShopify.com", orderId: "gid://shopify/Order/1", total: "120.50", recommended: 40, currency: "EUR" };

test("parseConversion normalizes a valid payload", () => {
  assert.deepEqual(parseConversion(valid, { attributedKey: "recommended" }), {
    shop: "demo.myshopify.com",
    orderId: "gid://shopify/Order/1",
    total: 120.5,
    attributed: 40,
    currency: "EUR",
  });
});

test("parseConversion reads the attributed amount from the given key", () => {
  assert.equal(parseConversion({ ...valid, calculated: 12 }, { attributedKey: "calculated" }).attributed, 12);
  assert.equal(parseConversion(valid, { attributedKey: "calculated" }).attributed, 0);
});

test("parseConversion caps the attributed amount at the total", () => {
  assert.equal(parseConversion({ ...valid, total: 50, recommended: 80 }, { attributedKey: "recommended" }).attributed, 50);
});

test("parseConversion clips the order id and currency", () => {
  const c = parseConversion({ ...valid, orderId: "x".repeat(200), currency: "TOOLONGCODE" }, { attributedKey: "recommended" });
  assert.equal(c.orderId.length, 128);
  assert.equal(c.currency, "TOOLONGC");
  assert.equal(parseConversion({ ...valid, currency: 978 }, { attributedKey: "recommended" }).currency, null);
});

test("parseConversion rejects bad payloads", () => {
  const bad = [
    {},
    { ...valid, shop: "evil.com" },
    { ...valid, shop: undefined },
    { ...valid, orderId: "" },
    { ...valid, orderId: 123 },
    { ...valid, total: -1 },
    { ...valid, total: "abc" },
    { ...valid, total: undefined },
  ];
  for (const body of bad) assert.equal(parseConversion(body, { attributedKey: "recommended" }), null, JSON.stringify(body));
});
