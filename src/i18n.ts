export type Translations = Record<string, Record<string, string>>;

// "pt-BR" -> "pt", "TR" -> "tr". Empty or missing gives the fallback.
export function baseLanguage(locale: string | null | undefined, fallback: string = "en"): string {
  const lang = (locale ?? "").split(/[-_]/)[0].trim().toLowerCase();
  return lang || fallback;
}

// Fills each language's missing keys from the base language and keeps its own texts.
// Returns a new object; the input is not changed.
export function withFallback(translations: Translations, base: string = "en"): Translations {
  const baseTexts = translations[base] ?? {};
  return Object.fromEntries(
    Object.entries(translations).map(([lang, texts]) => [lang, lang === base ? { ...texts } : { ...baseTexts, ...texts }]),
  );
}

// Replaces every {name} in the text. Unknown placeholders are left as they are.
export function interpolate(text: string, vars?: Record<string, string | number | null | undefined>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (vars[name] == null ? match : String(vars[name])));
}

// Texts stored per locale as JSON ({ "default": "...", "tr": "..." }). An empty value gives
// { default: fallback }; a legacy plain string (or JSON that is not an object) becomes the default.
export function parseLocalized<T = string>(stored: string | null | undefined, fallback: T): Record<string, T> {
  if (!stored) return { default: fallback };
  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, T>;
  } catch {
    // not JSON: a plain text
  }
  return { default: stored as unknown as T };
}
