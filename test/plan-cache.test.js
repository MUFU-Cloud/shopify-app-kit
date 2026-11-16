import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryPlanCache } from "../dist/index.js";

test("get/set/delete", () => {
  const cache = createMemoryPlanCache();
  assert.equal(cache.get("a"), undefined);
  cache.set("a", true);
  cache.set("b", false);
  assert.equal(cache.get("a"), true);
  assert.equal(cache.get("b"), false);
  cache.delete("a");
  assert.equal(cache.get("a"), undefined);
});

test("entries expire after ttlMs", () => {
  let now = 0;
  const cache = createMemoryPlanCache({ ttlMs: 1000, now: () => now });
  cache.set("a", true);
  now = 999;
  assert.equal(cache.get("a"), true);
  now = 1000;
  assert.equal(cache.get("a"), undefined);
});

test("evicts the oldest entry over max", () => {
  const cache = createMemoryPlanCache({ max: 2 });
  cache.set("a", true);
  cache.set("b", true);
  cache.set("a", false);
  cache.set("c", true);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), false);
  assert.equal(cache.get("c"), true);
});
