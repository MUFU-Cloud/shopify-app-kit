export type AdminGraphql = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export interface MetafieldValue {
  key: string;
  type: "boolean" | "json" | "single_line_text_field" | (string & {});
  value: string;
}

export async function getShopId(admin: AdminGraphql): Promise<string> {
  const res = await admin.graphql(`#graphql
    query ShopId { shop { id } }`);
  const json: any = await res.json();
  return json.data.shop.id;
}

export async function setMetafields(admin: AdminGraphql, namespace: string, ownerId: string, fields: MetafieldValue[]) {
  if (fields.length === 0) return;
  const res = await admin.graphql(
    `#graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }`,
    { variables: { metafields: fields.map((f) => ({ ...f, namespace, ownerId })) } },
  );
  const json: any = await res.json();
  const errors = json?.data?.metafieldsSet?.userErrors;
  if (errors?.length) console.error("metafieldsSet errors", errors);
}

// null = fine, or not checkable (e.g. no read_discounts)
export async function checkDiscountCode(admin: AdminGraphql, code: string): Promise<"not_found" | "inactive" | null> {
  try {
    const res = await admin.graphql(
      `#graphql
      query DiscountByCode($code: String!) {
        codeDiscountNodeByCode(code: $code) {
          id
          codeDiscount {
            ... on DiscountCodeBasic { status }
            ... on DiscountCodeBxgy { status }
            ... on DiscountCodeFreeShipping { status }
            ... on DiscountCodeApp { status }
          }
        }
      }`,
      { variables: { code } },
    );
    const json: any = await res.json();
    if (json.errors?.length) return null;
    const node = json.data?.codeDiscountNodeByCode;
    if (!node) return "not_found";
    const status = node.codeDiscount?.status;
    return status && status !== "ACTIVE" ? "inactive" : null;
  } catch (e) {
    console.warn("discount code check skipped", e);
    return null;
  }
}

// false when write_pixels isn't granted yet
export async function ensureWebPixel(admin: AdminGraphql, appUrl: string, path = "/api/conversion"): Promise<boolean> {
  if (!appUrl) return false;
  const settings = JSON.stringify({ endpoint: `${appUrl.replace(/\/$/, "")}${path}` });
  try {
    const existing = await admin.graphql(`#graphql
      query WebPixel { webPixel { id settings } }`);
    const json: any = await existing.json();
    const pixel = json?.data?.webPixel;

    if (pixel?.id) {
      if (pixel.settings === settings) return true;
      await admin.graphql(
        `#graphql
          mutation WebPixelUpdate($id: ID!, $webPixel: WebPixelInput!) {
            webPixelUpdate(id: $id, webPixel: $webPixel) { userErrors { field message } }
          }`,
        { variables: { id: pixel.id, webPixel: { settings } } },
      );
      return true;
    }
  } catch {
    // throws when there is no pixel yet
  }

  try {
    const res = await admin.graphql(
      `#graphql
        mutation WebPixelCreate($webPixel: WebPixelInput!) {
          webPixelCreate(webPixel: $webPixel) { userErrors { field message code } webPixel { id } }
        }`,
      { variables: { webPixel: { settings } } },
    );
    const json: any = await res.json();
    const errors = json?.data?.webPixelCreate?.userErrors;
    if (errors?.length) {
      console.error("webPixelCreate errors", errors);
      return false;
    }
    return true;
  } catch (e) {
    console.error("webPixelCreate failed (missing write_pixels scope?)", e);
    return false;
  }
}
