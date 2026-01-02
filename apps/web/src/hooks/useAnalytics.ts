import { useGetAnalyticsQuery } from '@/lib/store/api/analyticsApi';

/**
 * Hook for fetching analytics data
 */
export function useAnalytics(month?: number, year?: number) {
  const { data, isLoading, error, refetch } = useGetAnalyticsQuery(
    month && year ? { month, year } : undefined
  );

  return {
    analytics: data?.data || null,
    isLoading,
    error,
    refetch,
  };
}

