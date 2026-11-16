// Free plan: features on up to this many products. Pro: unlimited.
export const FREE_PRODUCT_LIMIT = 5;

// `index` is the item's position when sorted oldest first.
export const isLiveOnPlan = (index: number, isPro: boolean, limit: number = FREE_PRODUCT_LIMIT): boolean =>
  isPro || index < limit;

export interface PlanLimitOptions<T> {
  isPro: boolean;
  limit?: number;
  createdAt: (item: T) => Date | string | number;
}

// Over the Free limit items stay saved but go offline; the oldest ones stay live.
export function splitByPlanLimit<T>(items: readonly T[], options: PlanLimitOptions<T>): { live: T[]; offline: T[] } {
  const { isPro, limit = FREE_PRODUCT_LIMIT, createdAt } = options;
  if (isPro) return { live: [...items], offline: [] };

  // invalid dates count as newest
  const time = items.map((item) => {
    const t = new Date(createdAt(item)).getTime();
    return Number.isNaN(t) ? Infinity : t;
  });
  // sort is stable, so ties keep their input order
  const order = items.map((_, i) => i).sort((a, b) => (time[a] === time[b] ? 0 : time[a] - time[b]));
  const rank = new Array<number>(items.length);
  order.forEach((i, r) => (rank[i] = r));

  const live: T[] = [];
  const offline: T[] = [];
  items.forEach((item, i) => (isLiveOnPlan(rank[i], false, limit) ? live : offline).push(item));
  return { live, offline };
}
