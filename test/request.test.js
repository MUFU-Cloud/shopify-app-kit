import { test } from "node:test";
import assert from "node:assert/strict";
import { clip, readJsonObject } from "../dist/index.js";

const req = (body, type = "application/json") =>
  new Request("https://app.test/x", { method: "POST", headers: { "Content-Type": type }, body });

test("readJsonObject returns the parsed object", async () => {
  assert.deepEqual(await readJsonObject(req('{"a":1,"b":"x"}')), { a: 1, b: "x" });
});

test("readJsonObject reads text/plain bodies", async () => {
  assert.deepEqual(await readJsonObject(req('{"shop":"a"}', "text/plain")), { shop: "a" });
});

test("readJsonObject returns null for invalid JSON", async () => {
  assert.equal(await readJsonObject(req("{")), null);
  assert.equal(await readJsonObject(req("")), null);
  assert.equal(await readJsonObject(req("not json")), null);
});

test("readJsonObject returns {} for JSON that is not an object", async () => {
  for (const body of ["null", "42", '"text"', "[1,2]", "true"]) {
    assert.deepEqual(await readJsonObject(req(body)), {}, body);
  }
});

test("clip", () => {
  assert.equal(clip("hello"), "hello");
  assert.equal(clip("x".repeat(300)), "x".repeat(255));
  assert.equal(clip("abcdef", 3), "abc");
  assert.equal(clip(""), null);
  assert.equal(clip(42), null);
  assert.equal(clip(null), null);
  assert.equal(clip(undefined), null);
});
