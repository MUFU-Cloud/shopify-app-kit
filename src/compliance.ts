// The customer's email from a customers/redact or customers/data_request webhook payload,
// trimmed and lowercased, or null.
export function customerEmail(payload: unknown): string | null {
  const email = (payload as { customer?: { email?: unknown } } | null | undefined)?.customer?.email;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}
