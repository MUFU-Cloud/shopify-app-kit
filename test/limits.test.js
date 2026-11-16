import { test } from "node:test";
import assert from "node:assert/strict";
import { FREE_PRODUCT_LIMIT, isLiveOnPlan, splitByPlanLimit } from "../dist/index.js";

const at = (item) => item.at;
const ids = (list) => list.map((x) => x.id);

test("isLiveOnPlan", () => {
  assert.equal(FREE_PRODUCT_LIMIT, 5);
  assert.equal(isLiveOnPlan(4, false), true);
  assert.equal(isLiveOnPlan(5, false), false);
  assert.equal(isLiveOnPlan(99, true), true);
  assert.equal(isLiveOnPlan(1, false, 1), false);
});

test("Pro keeps everything live", () => {
  const items = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, at: id }));
  const { live, offline } = splitByPlanLimit(items, { isPro: true, createdAt: at });
  assert.deepEqual(ids(live), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(offline, []);
});

test("Free keeps the oldest live and preserves input order", () => {
  const items = [
    { id: "e", at: 50 },
    { id: "a", at: 10 },
    { id: "d", at: 40 },
    { id: "b", at: 20 },
    { id: "c", at: 30 },
  ];
  const { live, offline } = splitByPlanLimit(items, { isPro: false, limit: 3, createdAt: at });
  assert.deepEqual(ids(live), ["a", "b", "c"]);
  assert.deepEqual(ids(offline), ["e", "d"]);
});

test("ties keep input order", () => {
  const items = [
    { id: 1, at: 5 },
    { id: 2, at: 1 },
    { id: 3, at: 5 },
    { id: 4, at: 5 },
  ];
  const { live, offline } = splitByPlanLimit(items, { isPro: false, limit: 3, createdAt: at });
  assert.deepEqual(ids(live), [1, 2, 3]);
  assert.deepEqual(ids(offline), [4]);
});

test("default limit is 5", () => {
  const items = [7, 6, 5, 4, 3, 2, 1].map((id) => ({ id, at: id }));
  const { live, offline } = splitByPlanLimit(items, { isPro: false, createdAt: at });
  assert.deepEqual(ids(live), [5, 4, 3, 2, 1]);
  assert.deepEqual(ids(offline), [7, 6]);
});

test("limit 0 puts everything offline", () => {
  const items = [{ id: 1, at: 1 }, { id: 2, at: 2 }];
  const { live, offline } = splitByPlanLimit(items, { isPro: false, limit: 0, createdAt: at });
  assert.deepEqual(live, []);
  assert.deepEqual(ids(offline), [1, 2]);
});

test("createdAt as Date, ISO string or number", () => {
  const items = [
    { id: "date", at: new Date("2026-03-01T00:00:00Z") },
    { id: "string", at: "2026-01-01T00:00:00Z" },
    { id: "number", at: Date.UTC(2026, 1, 1) },
  ];
  const { live, offline } = splitByPlanLimit(items, { isPro: false, limit: 2, createdAt: at });
  assert.deepEqual(ids(live), ["string", "number"]);
  assert.deepEqual(ids(offline), ["date"]);
});

test("invalid createdAt counts as newest", () => {
  const items = [{ id: "bad", at: "nope" }, { id: "ok", at: 1 }];
  const { live, offline } = splitByPlanLimit(items, { isPro: false, limit: 1, createdAt: at });
  assert.deepEqual(ids(live), ["ok"]);
  assert.deepEqual(ids(offline), ["bad"]);
});

test("empty list", () => {
  assert.deepEqual(splitByPlanLimit([], { isPro: false, createdAt: at }), { live: [], offline: [] });
});
