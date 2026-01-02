import { apiSlice } from './apiSlice';

// Enums
export enum SubscriptionTier {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum ToolStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  EXPIRED = 'EXPIRED',
  DISABLED = 'DISABLED',
}

// Types
export interface ToolDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  isCore: boolean;
  isActive: boolean;
  features: { name: string; description: string }[] | null;
  targetRoles: string[];
}

export interface SchoolToolAccessDto {
  id: string;
  toolId: string;
  tool: ToolDto;
  status: ToolStatus;
  trialEndsAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
}

export interface SubscriptionDto {
  id: string;
  schoolId: string;
  tier: SubscriptionTier;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  maxStudents: number;
  maxTeachers: number;
  maxAdmins: number;
  aiCredits: number;
  aiCreditsUsed: number;
  aiCreditsRemaining: number;
  toolAccess: SchoolToolAccessDto[];
}

export interface SubscriptionSummaryDto {
  tier: SubscriptionTier;
  isActive: boolean;
  aiCredits: number;        // -1 = unlimited
  aiCreditsUsed: number;
  aiCreditsRemaining: number;
  limits: {
    maxStudents: number;    // -1 = unlimited
    maxTeachers: number;    // -1 = unlimited
    maxAdmins: number;      // -1 = unlimited (Enterprise only)
  };
  tools: {
    slug: string;
    name: string;
    status: ToolStatus;
    hasAccess: boolean;
  }[];
}

export interface ToolAccessResultDto {
  hasAccess: boolean;
  status: ToolStatus | null;
  tool: ToolDto | null;
  reason?: string;
  trialDaysRemaining?: number;
}

export interface AiCreditsResultDto {
  success: boolean;
  creditsUsed: number;
  creditsRemaining: number;
  message?: string;
}

export interface UseAiCreditsRequest {
  credits: number;
  action?: string;
}

// Response wrapper
export interface ResponseDto<T> {
  success: boolean;
  data: T;
}

// API Slice
export const subscriptionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get current school's subscription
    getMySubscription: builder.query<ResponseDto<SubscriptionDto>, void>({
      query: () => '/subscriptions/my-subscription',
      providesTags: ['Subscription'],
    }),

    // Get subscription summary (lightweight)
    getSubscriptionSummary: builder.query<ResponseDto<SubscriptionSummaryDto | null>, void>({
      query: () => '/subscriptions/summary',
      providesTags: ['Subscription'],
    }),

    // Check tool access
    checkToolAccess: builder.query<ResponseDto<ToolAccessResultDto>, string>({
      query: (toolSlug) => `/subscriptions/tools/${toolSlug}/access`,
      providesTags: (_result, _error, toolSlug) => [{ type: 'Subscription', id: `tool-${toolSlug}` }],
    }),

    // Get all available tools
    getAllTools: builder.query<ResponseDto<ToolDto[]>, void>({
      query: () => '/subscriptions/tools',
      providesTags: ['Subscription'],
    }),

    // Get tools for current user's role
    getMyTools: builder.query<ResponseDto<ToolDto[]>, void>({
      query: () => '/subscriptions/tools/my-tools',
      providesTags: ['Subscription'],
    }),

    // Use AI credits
    useAiCredits: builder.mutation<ResponseDto<AiCreditsResultDto>, UseAiCreditsRequest>({
      query: (body) => ({
        url: '/subscriptions/ai-credits/use',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Subscription'],
    }),
  }),
});

// Export hooks
export const {
  useGetMySubscriptionQuery,
  useGetSubscriptionSummaryQuery,
  useCheckToolAccessQuery,
  useGetAllToolsQuery,
  useGetMyToolsQuery,
  useUseAiCreditsMutation,
} = subscriptionsApi;

