import { apiSlice } from './apiSlice';

export interface AnalyticsData {
  totalSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  primarySchools: number;
  secondarySchools: number;
  tertiarySchools: number;
  activeSessions: number;
  growthTrends: Array<{ name: string; schools: number; students: number; teachers: number; admins: number }>;
  userDistribution: { students: number; teachers: number; admins: number };
  weeklyActivity: Array<{ name: string; logins: number; registrations: number }>;
  schoolDistribution: Array<{ name: string; value: number }>;
  schoolDistributionByLevel: Array<{ name: string; value: number }>;
  schoolDistributionByLocation: Array<{ name: string; value: number }>;
  schoolDistributionByCity: Array<{ name: string; value: number }>;
  recentActivity: Array<{ type: string; description: string; timestamp: string }>;
}

export interface ResponseDto<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

// RTK Query endpoints for analytics
export const analyticsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get analytics data
    getAnalytics: builder.query<ResponseDto<AnalyticsData>, { month?: number; year?: number } | void>({
      query: (params) => {
        if (params && (params.month || params.year)) {
          const queryParams = new URLSearchParams();
          if (params.month) queryParams.append('month', params.month.toString());
          if (params.year) queryParams.append('year', params.year.toString());
          return `/analytics?${queryParams.toString()}`;
        }
        return '/analytics';
      },
      providesTags: ['School'],
    }),
  }),
});

export const { useGetAnalyticsQuery } = analyticsApi;

