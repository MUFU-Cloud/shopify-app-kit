// Reads a JSON request body. Returns null when the body is not JSON, and {} when it is JSON but not
// an object (null, a number, an array), so callers can validate fields without type checks first.
// Reads the raw text, so it works for application/json and for text/plain (sent to avoid a CORS
// preflight, as web pixels do).
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await request.text());
  } catch {
    return null;
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

// A non-empty string cut to `max` characters, or null.
export const clip = (value: unknown, max: number = 255): string | null =>
  typeof value === "string" && value ? value.slice(0, max) : null;
