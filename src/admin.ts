import type { Logger } from "./logger.js";

export type AdminGraphql = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export interface MetafieldValue {
  key: string;
  type: "boolean" | "json" | "single_line_text_field" | (string & {});
  value: string;
}

export interface MetafieldUserError {
  field: string[] | null;
  message: string;
}

export interface AdminOptions {
  logger?: Logger;
}

// metafieldsSet takes at most 25 metafields per call
const METAFIELDS_SET_LIMIT = 25;

export async function getShopId(admin: AdminGraphql, _options: AdminOptions = {}): Promise<string> {
  const res = await admin.graphql(`#graphql
    query ShopId { shop { id } }`);
  const json: any = await res.json();
  if (json?.errors?.length) {
    throw new Error(`Shop id query failed: ${json.errors.map((e: any) => e?.message ?? e).join("; ")}`);
  }
  const id = json?.data?.shop?.id;
  if (!id) throw new Error("Shop id query returned no shop.id");
  return id;
}

function topLevelErrors(json: any): MetafieldUserError[] {
  return (json?.errors ?? []).map((e: any) => ({ field: null, message: String(e?.message ?? e) }));
}

export async function setMetafields(
  admin: AdminGraphql,
  namespace: string,
  ownerId: string,
  fields: MetafieldValue[],
  options: AdminOptions = {},
): Promise<MetafieldUserError[]> {
  const { logger = console } = options;
  const errors: MetafieldUserError[] = [];
  for (let i = 0; i < fields.length; i += METAFIELDS_SET_LIMIT) {
    const chunk = fields.slice(i, i + METAFIELDS_SET_LIMIT);
    const res = await admin.graphql(
      `#graphql
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }`,
      { variables: { metafields: chunk.map((f) => ({ ...f, namespace, ownerId })) } },
    );
    const json: any = await res.json();
    errors.push(...topLevelErrors(json), ...(json?.data?.metafieldsSet?.userErrors ?? []));
  }
  if (errors.length) logger.error("metafieldsSet errors", errors);
  return errors;
}

export async function deleteMetafields(
  admin: AdminGraphql,
  namespace: string,
  ownerId: string,
  keys: string[],
  options: AdminOptions = {},
): Promise<MetafieldUserError[]> {
  const { logger = console } = options;
  if (keys.length === 0) return [];
  const res = await admin.graphql(
    `#graphql
      mutation MetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          userErrors { field message }
        }
      }`,
    { variables: { metafields: keys.map((key) => ({ ownerId, namespace, key })) } },
  );
  const json: any = await res.json();
  const errors: MetafieldUserError[] = [...topLevelErrors(json), ...(json?.data?.metafieldsDelete?.userErrors ?? [])];
  if (errors.length) logger.error("metafieldsDelete errors", errors);
  return errors;
}

// null = fine, or not checkable (e.g. no read_discounts)
export async function checkDiscountCode(
  admin: AdminGraphql,
  code: string,
  options: AdminOptions = {},
): Promise<"not_found" | "inactive" | null> {
  const { logger = console } = options;
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
    logger.warn("discount code check skipped", e);
    return null;
  }
}

// false when write_pixels isn't granted yet
export async function ensureWebPixel(
  admin: AdminGraphql,
  appUrl: string,
  path = "/api/conversion",
  options: AdminOptions = {},
): Promise<boolean> {
  const { logger = console } = options;
  if (!appUrl) return false;
  const settings = JSON.stringify({ endpoint: `${appUrl.replace(/\/$/, "")}${path}` });

  let pixel: { id: string; settings: string | null } | null = null;
  try {
    const existing = await admin.graphql(`#graphql
      query WebPixel { webPixel { id settings } }`);
    const json: any = await existing.json();
    if (json?.data?.webPixel?.id) pixel = json.data.webPixel;
  } catch {
    // throws when there is no pixel yet
  }

  if (pixel) {
    if (pixel.settings === settings) return true;
    try {
      const res = await admin.graphql(
        `#graphql
          mutation WebPixelUpdate($id: ID!, $webPixel: WebPixelInput!) {
            webPixelUpdate(id: $id, webPixel: $webPixel) { userErrors { field message code } webPixel { id } }
          }`,
        { variables: { id: pixel.id, webPixel: { settings } } },
      );
      const json: any = await res.json();
      const errors = json?.data?.webPixelUpdate?.userErrors;
      if (errors?.length) {
        logger.error("webPixelUpdate errors", errors);
        return false;
      }
      return true;
    } catch (e) {
      logger.error("webPixelUpdate failed", e);
      return false;
    }
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
      logger.error("webPixelCreate errors", errors);
      return false;
    }
    return true;
  } catch (e) {
    logger.error("webPixelCreate failed (missing write_pixels scope?)", e);
    return false;
  }
}
