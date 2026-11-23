export const EMAIL_MAX_LENGTH = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Trimmed and lowercased, or "" when it is not a string.
export const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isValidEmail = (email: string): boolean => email.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(email);

export type LeadError = "invalid_email" | "consent_required";

// Checks a storefront lead form body: a valid email and `consent: true` (the boolean, not a truthy value).
export function parseLead(body: Record<string, unknown>): { ok: true; email: string } | { ok: false; error: LeadError } {
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return { ok: false, error: "invalid_email" };
  if (body.consent !== true) return { ok: false, error: "consent_required" };
  return { ok: true, email };
}
