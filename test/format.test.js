import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, formatNumber, formatPercent, formatUtcDate, formatUtcDateTime } from "../dist/index.js";

test("formatNumber", () => {
  assert.equal(formatNumber(1234567.891), "1,234,567.891");
  assert.equal(formatNumber(1234.5, { maximumFractionDigits: 0 }), "1,235");
  assert.equal(formatNumber(1234.5, { locale: "de-DE" }), "1.234,5");
  assert.equal(formatNumber(0), "0");
});

test("formatMoney", () => {
  assert.equal(formatMoney(1234.5, "USD"), "$1,234.50");
  assert.equal(formatMoney(1234.5, "EUR"), "€1,234.50");
  assert.equal(formatMoney(1234.5, "EUR", "de-DE"), "1.234,50 €");
  assert.equal(formatMoney(12, null), "12.00");
  assert.equal(formatMoney(12, "NOPE1"), "12.00 NOPE1");
});

test("formatPercent", () => {
  assert.equal(formatPercent(0.1234), "12.3%");
  assert.equal(formatPercent(0.5, 0), "50%");
  assert.equal(formatPercent(1), "100.0%");
});

test("formatUtcDateTime", () => {
  assert.equal(formatUtcDateTime("2026-11-16T09:05:59.999Z"), "2026-11-16 09:05 UTC");
  assert.equal(formatUtcDateTime(new Date(Date.UTC(2026, 10, 16, 23, 59))), "2026-11-16 23:59 UTC");
  assert.equal(formatUtcDateTime("2026-11-16T01:30:00+03:00"), "2026-11-15 22:30 UTC");
  assert.equal(formatUtcDateTime(0), "1970-01-01 00:00 UTC");
});

test("formatUtcDate", () => {
  assert.equal(formatUtcDate("2026-11-16T23:30:00-02:00"), "2026-11-17");
  assert.equal(formatUtcDate(new Date(Date.UTC(2026, 10, 16))), "2026-11-16");
});

test("invalid dates give an empty string", () => {
  assert.equal(formatUtcDateTime("not a date"), "");
  assert.equal(formatUtcDate(new Date(NaN)), "");
  assert.equal(formatUtcDateTime(""), "");
});
