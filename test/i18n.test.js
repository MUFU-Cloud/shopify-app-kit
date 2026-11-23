import { test } from "node:test";
import assert from "node:assert/strict";
import { baseLanguage, customerEmail, interpolate, parseLocalized, pricingPlansUrl, withFallback } from "../dist/index.js";

test("baseLanguage", () => {
  assert.equal(baseLanguage("pt-BR"), "pt");
  assert.equal(baseLanguage("TR"), "tr");
  assert.equal(baseLanguage("zh_TW"), "zh");
  assert.equal(baseLanguage(""), "en");
  assert.equal(baseLanguage(null), "en");
  assert.equal(baseLanguage(undefined, "de"), "de");
});

test("withFallback fills missing keys and keeps translated ones", () => {
  const input = { en: { a: "A", b: "B" }, de: { a: "Ä" }, tr: {} };
  const out = withFallback(input);
  assert.deepEqual(out, { en: { a: "A", b: "B" }, de: { a: "Ä", b: "B" }, tr: { a: "A", b: "B" } });
  // input untouched
  assert.deepEqual(input.de, { a: "Ä" });
  out.en.a = "changed";
  assert.equal(input.en.a, "A");
});

test("withFallback with another base and a missing base", () => {
  assert.deepEqual(withFallback({ tr: { a: "Bir" }, en: {} }, "tr"), { tr: { a: "Bir" }, en: { a: "Bir" } });
  assert.deepEqual(withFallback({ de: { a: "Ä" } }), { de: { a: "Ä" } });
});

test("interpolate replaces every placeholder", () => {
  assert.equal(interpolate("{n} of {n} left", { n: 3 }), "3 of 3 left");
  assert.equal(interpolate("Gain {weight} {unit}", { weight: "2.5", unit: "kg" }), "Gain 2.5 kg");
  assert.equal(interpolate("Hi {name}", {}), "Hi {name}");
  assert.equal(interpolate("Hi {name}", { name: null }), "Hi {name}");
  assert.equal(interpolate("No vars"), "No vars");
  assert.equal(interpolate("{a}", { a: 0 }), "0");
});

test("parseLocalized", () => {
  assert.deepEqual(parseLocalized(null, "x"), { default: "x" });
  assert.deepEqual(parseLocalized("", "x"), { default: "x" });
  assert.deepEqual(parseLocalized('{"default":"Hi","tr":"Selam"}', "x"), { default: "Hi", tr: "Selam" });
  assert.deepEqual(parseLocalized("Healthy", "x"), { default: "Healthy" });
  assert.deepEqual(parseLocalized("42", "x"), { default: "42" });
  assert.deepEqual(parseLocalized("[1]", "x"), { default: "[1]" });
  assert.deepEqual(parseLocalized('{"default":[{"handle":"a"}]}', []), { default: [{ handle: "a" }] });
});

test("customerEmail", () => {
  assert.equal(customerEmail({ customer: { email: " Jane@Example.com " } }), "jane@example.com");
  for (const payload of [{ customer: {} }, { customer: { email: "  " } }, { customer: { email: 1 } }, {}, null, undefined]) {
    assert.equal(customerEmail(payload), null, JSON.stringify(payload));
  }
});

test("pricingPlansUrl", () => {
  assert.equal(
    pricingPlansUrl("demo.myshopify.com", "my-app"),
    "https://admin.shopify.com/store/demo/charges/my-app/pricing_plans",
  );
  assert.equal(pricingPlansUrl("demo", "my-app"), "https://admin.shopify.com/store/demo/charges/my-app/pricing_plans");
});
