import type { Logger } from "./logger.js";

export const KLAVIYO_REVISION = "2026-10-15";

// Client subscriptions endpoint, works with the public key only.
export async function subscribeToKlaviyo(opts: {
  publicKey: string;
  listId: string;
  email: string;
  source: string;
  properties?: Record<string, string | null | undefined>;
  logger?: Logger;
  timeoutMs?: number;
  fetch?: typeof fetch;
}): Promise<boolean> {
  const { publicKey, listId, email, source, properties, logger = console, timeoutMs = 8000 } = opts;
  const doFetch = opts.fetch ?? fetch;
  try {
    const res = await doFetch(`https://a.klaviyo.com/client/subscriptions/?company_id=${encodeURIComponent(publicKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.api+json",
        accept: "application/vnd.api+json",
        revision: KLAVIYO_REVISION,
      },
      body: JSON.stringify({
        data: {
          type: "subscription",
          attributes: {
            custom_source: source,
            profile: {
              data: {
                type: "profile",
                attributes: {
                  email,
                  properties: properties ?? {},
                  subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
                },
              },
            },
          },
          relationships: { list: { data: { type: "list", id: listId } } },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      logger.error("Klaviyo subscribe failed", res.status, await res.text().catch(() => ""));
    }
    return res.ok;
  } catch (e) {
    logger.error("Klaviyo subscribe failed", e);
    return false;
  }
}
