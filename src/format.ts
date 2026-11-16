// Fixed locale and UTC: the server and the browser must print the same text, or hydration fails.
export const DEFAULT_LOCALE = "en-US";

const cache = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(options);
  let nf = cache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, options);
    cache.set(key, nf);
  }
  return nf;
}

export function formatNumber(n: number, options: Intl.NumberFormatOptions & { locale?: string } = {}): string {
  const { locale = DEFAULT_LOCALE, ...rest } = options;
  return numberFormat(locale, rest).format(n);
}

export function formatMoney(amount: number, currency: string | null | undefined, locale: string = DEFAULT_LOCALE): string {
  if (!currency) return amount.toFixed(2);
  try {
    return numberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatPercent(ratio: number, digits: number = 1): string {
  return numberFormat(DEFAULT_LOCALE, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}

// Invalid dates give "" so a bad row doesn't break the page.
function utcIso(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function formatUtcDateTime(value: Date | string | number): string {
  const iso = utcIso(value);
  return iso && `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

export function formatUtcDate(value: Date | string | number): string {
  return utcIso(value).slice(0, 10);
}
