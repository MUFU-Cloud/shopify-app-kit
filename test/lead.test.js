import { test } from "node:test";
import assert from "node:assert/strict";
import { EMAIL_MAX_LENGTH, isValidEmail, normalizeEmail, parseLead } from "../dist/index.js";

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Jane@Example.COM "), "jane@example.com");
  assert.equal(normalizeEmail(42), "");
  assert.equal(normalizeEmail(undefined), "");
});

test("isValidEmail", () => {
  assert.equal(isValidEmail("jane@example.com"), true);
  assert.equal(isValidEmail("a.b+tag@sub.example.co"), true);
  for (const bad of ["", "jane", "jane@", "@example.com", "jane@example", "ja ne@example.com", "jane@@example.com"]) {
    assert.equal(isValidEmail(bad), false, bad);
  }
});

test("isValidEmail rejects addresses longer than 254 characters", () => {
  const at = (n) => "a".repeat(n - "@example.com".length) + "@example.com";
  assert.equal(isValidEmail(at(EMAIL_MAX_LENGTH)), true);
  assert.equal(isValidEmail(at(EMAIL_MAX_LENGTH + 1)), false);
});

test("parseLead accepts a valid email with consent", () => {
  assert.deepEqual(parseLead({ email: " Jane@Example.com", consent: true }), { ok: true, email: "jane@example.com" });
});

test("parseLead checks the email before consent", () => {
  assert.deepEqual(parseLead({ email: "nope", consent: false }), { ok: false, error: "invalid_email" });
});

test("parseLead needs consent to be exactly true", () => {
  for (const consent of [undefined, false, "true", 1, "yes"]) {
    assert.deepEqual(parseLead({ email: "jane@example.com", consent }), { ok: false, error: "consent_required" }, String(consent));
  }
});
