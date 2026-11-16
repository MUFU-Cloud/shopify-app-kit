export interface PlanCache {
  get(shopGid: string): boolean | undefined;
  set(shopGid: string, isPro: boolean): void;
  delete(shopGid: string): void;
}

export interface MemoryPlanCacheOptions {
  ttlMs?: number;
  max?: number;
  now?: () => number;
}

export function createMemoryPlanCache({ ttlMs = 5 * 60_000, max = 1000, now = Date.now }: MemoryPlanCacheOptions = {}): PlanCache {
  const entries = new Map<string, { isPro: boolean; expires: number }>();

  return {
    get(shopGid) {
      const entry = entries.get(shopGid);
      if (!entry) return undefined;
      if (entry.expires <= now()) {
        entries.delete(shopGid);
        return undefined;
      }
      return entry.isPro;
    },
    set(shopGid, isPro) {
      // re-insert so Map order stays oldest-first
      entries.delete(shopGid);
      entries.set(shopGid, { isPro, expires: now() + ttlMs });
      while (entries.size > max) entries.delete(entries.keys().next().value as string);
    },
    delete(shopGid) {
      entries.delete(shopGid);
    },
  };
}
