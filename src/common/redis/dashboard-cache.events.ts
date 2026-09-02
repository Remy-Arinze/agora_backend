export const DASHBOARD_CACHE_INVALIDATE = 'dashboard.cache.invalidate';

export const DASHBOARD_CACHE_TTL_SECONDS = 45;

export function dashboardCacheKey(
  kind: 'summary' | 'charts',
  schoolId: string,
  schoolType?: string | null
): string {
  return `agora:dashboard:${schoolId}:${schoolType || 'all'}:${kind}`;
}

export function dashboardCachePrefix(schoolId: string): string {
  return `agora:dashboard:${schoolId}:`;
}
