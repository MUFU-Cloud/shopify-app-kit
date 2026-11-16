import { test } from "node:test";
import assert from "node:assert/strict";
import { getShopId, setMetafields, deleteMetafields, checkDiscountCode, ensureWebPixel } from "../dist/index.js";

const quiet = { error() {}, warn() {} };
const json = (body) => new Response(JSON.stringify(body), { status: 200 });

// handler(query, variables) returns a response body or throws
function fakeAdmin(handler) {
  const calls = [];
  return {
    calls,
    graphql: async (query, opts) => {
      calls.push({ query, variables: opts?.variables });
      return json(await handler(query, opts?.variables));
    },
  };
}

const fields = (n) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, type: "boolean", value: "true" }));

test("getShopId returns the id", async () => {
  const admin = fakeAdmin(() => ({ data: { shop: { id: "gid://shopify/Shop/1" } } }));
  assert.equal(await getShopId(admin), "gid://shopify/Shop/1");
});

test("getShopId throws on GraphQL errors or missing id", async () => {
  await assert.rejects(getShopId(fakeAdmin(() => ({ errors: [{ message: "Access denied" }] }))), /Access denied/);
  await assert.rejects(getShopId(fakeAdmin(() => ({ data: { shop: null } }))), /no shop\.id/);
});

test("setMetafields does nothing for an empty list", async () => {
  const admin = fakeAdmin(() => assert.fail("should not call"));
  assert.deepEqual(await setMetafields(admin, "ns", "gid://shopify/Product/1", []), []);
});

test("setMetafields chunks at 25 and adds namespace/ownerId", async () => {
  const admin = fakeAdmin(() => ({ data: { metafieldsSet: { userErrors: [] } } }));
  const errors = await setMetafields(admin, "ns", "gid://shopify/Product/1", fields(51), { logger: quiet });
  assert.deepEqual(errors, []);
  assert.deepEqual(
    admin.calls.map((c) => c.variables.metafields.length),
    [25, 25, 1],
  );
  assert.deepEqual(admin.calls[2].variables.metafields[0], {
    key: "k50",
    type: "boolean",
    value: "true",
    namespace: "ns",
    ownerId: "gid://shopify/Product/1",
  });
});

test("setMetafields returns userErrors and top-level errors from all chunks", async () => {
  let n = 0;
  const admin = fakeAdmin(() => {
    n++;
    if (n === 1) return { data: { metafieldsSet: { userErrors: [{ field: ["metafields", "0", "value"], message: "bad" }] } } };
    return { errors: [{ message: "Throttled" }] };
  });
  const logged = [];
  const errors = await setMetafields(admin, "ns", "o", fields(30), { logger: { ...quiet, error: (...a) => logged.push(a) } });
  assert.deepEqual(errors, [
    { field: ["metafields", "0", "value"], message: "bad" },
    { field: null, message: "Throttled" },
  ]);
  assert.equal(logged.length, 1);
});

test("deleteMetafields sends identifiers and returns userErrors", async () => {
  const admin = fakeAdmin(() => ({
    data: { metafieldsDelete: { userErrors: [{ field: ["metafields", "1"], message: "nope" }] } },
  }));
  const errors = await deleteMetafields(admin, "ns", "gid://shopify/Product/1", ["a", "b"], { logger: quiet });
  assert.match(admin.calls[0].query, /metafieldsDelete\(metafields: \$metafields\)/);
  assert.deepEqual(admin.calls[0].variables, {
    metafields: [
      { ownerId: "gid://shopify/Product/1", namespace: "ns", key: "a" },
      { ownerId: "gid://shopify/Product/1", namespace: "ns", key: "b" },
    ],
  });
  assert.deepEqual(errors, [{ field: ["metafields", "1"], message: "nope" }]);
});

test("deleteMetafields with no keys does nothing", async () => {
  const admin = fakeAdmin(() => assert.fail("should not call"));
  assert.deepEqual(await deleteMetafields(admin, "ns", "o", []), []);
});

test("checkDiscountCode", async () => {
  const node = (status) => () => ({ data: { codeDiscountNodeByCode: status ? { id: "1", codeDiscount: { status } } : null } });
  assert.equal(await checkDiscountCode(fakeAdmin(node(null)), "X"), "not_found");
  assert.equal(await checkDiscountCode(fakeAdmin(node("EXPIRED")), "X"), "inactive");
  assert.equal(await checkDiscountCode(fakeAdmin(node("ACTIVE")), "X"), null);
  assert.equal(await checkDiscountCode(fakeAdmin(() => ({ errors: [{ message: "Access denied" }] })), "X"), null);

  const warned = [];
  const throwing = fakeAdmin(() => {
    throw new Error("scope");
  });
  assert.equal(await checkDiscountCode(throwing, "X", { logger: { ...quiet, warn: (...a) => warned.push(a) } }), null);
  assert.equal(warned.length, 1);
});

const settings = JSON.stringify({ endpoint: "https://app.example.com/api/conversion" });

test("ensureWebPixel creates a pixel when none exists", async () => {
  const admin = fakeAdmin((q) => {
    if (q.includes("query WebPixel")) throw new Error("No web pixel was found");
    return { data: { webPixelCreate: { userErrors: [], webPixel: { id: "p1" } } } };
  });
  assert.equal(await ensureWebPixel(admin, "https://app.example.com/", undefined, { logger: quiet }), true);
  assert.deepEqual(admin.calls[1].variables, { webPixel: { settings } });
});

test("ensureWebPixel leaves an unchanged pixel alone", async () => {
  const admin = fakeAdmin(() => ({ data: { webPixel: { id: "p1", settings } } }));
  assert.equal(await ensureWebPixel(admin, "https://app.example.com"), true);
  assert.equal(admin.calls.length, 1);
});

test("ensureWebPixel updates changed settings", async () => {
  const admin = fakeAdmin((q) =>
    q.includes("query WebPixel")
      ? { data: { webPixel: { id: "p1", settings: "{}" } } }
      : { data: { webPixelUpdate: { userErrors: [], webPixel: { id: "p1" } } } },
  );
  assert.equal(await ensureWebPixel(admin, "https://app.example.com"), true);
  assert.match(admin.calls[1].query, /webPixelUpdate/);
  assert.deepEqual(admin.calls[1].variables, { id: "p1", webPixel: { settings } });
});

test("ensureWebPixel returns false on update userErrors", async () => {
  const admin = fakeAdmin((q) =>
    q.includes("query WebPixel")
      ? { data: { webPixel: { id: "p1", settings: "{}" } } }
      : { data: { webPixelUpdate: { userErrors: [{ field: ["settings"], message: "invalid", code: "INVALID" }] } } },
  );
  assert.equal(await ensureWebPixel(admin, "https://app.example.com", undefined, { logger: quiet }), false);
  assert.equal(admin.calls.length, 2);
});

test("ensureWebPixel returns false without write_pixels", async () => {
  const admin = fakeAdmin(() => {
    throw new Error("Access denied");
  });
  assert.equal(await ensureWebPixel(admin, "https://app.example.com", undefined, { logger: quiet }), false);
  assert.equal(await ensureWebPixel(admin, ""), false);
});
