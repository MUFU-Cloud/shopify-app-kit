export const KLAVIYO_REVISION = "2024-10-15";

// Client subscriptions endpoint, works with the public key only.
export async function subscribeToKlaviyo(opts: {
  publicKey: string;
  listId: string;
  email: string;
  source: string;
  properties?: Record<string, string | null | undefined>;
}): Promise<boolean> {
  const { publicKey, listId, email, source, properties } = opts;
  const res = await fetch(`https://a.klaviyo.com/client/subscriptions/?company_id=${encodeURIComponent(publicKey)}`, {
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
          profile: { data: { type: "profile", attributes: { email, properties: properties ?? {} } } },
        },
        relationships: { list: { data: { type: "list", id: listId } } },
      },
    }),
  });
  if (!res.ok) {
    console.error("Klaviyo subscribe failed", res.status, await res.text().catch(() => ""));
  }
  return res.ok;
}
