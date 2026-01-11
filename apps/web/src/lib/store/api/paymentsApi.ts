import { apiSlice } from './apiSlice';
import { SubscriptionTier } from './subscriptionsApi';

// Types
export interface PricingPlan {
  monthly: number | null;
  yearly: number | null;
  features: string[];
}

export interface PricingResponse {
  FREE: PricingPlan;
  STARTER: PricingPlan;
  PROFESSIONAL: PricingPlan;
  ENTERPRISE: PricingPlan;
}

export interface InitializePaymentRequest {
  tier: SubscriptionTier;
  isYearly?: boolean;
}

export interface InitializePaymentResponse {
  success: boolean;
  message: string;
  data?: {
    reference: string;
    authorizationUrl: string;
    accessCode: string;
  };
}

export interface VerifyPaymentResponse {
  success: boolean;
  data: {
    success: boolean;
    reference: string;
    amount: number;
    status: string;
  };
}

// Response wrapper
export interface ResponseDto<T> {
  success: boolean;
  data: T;
}

// API Slice
export const paymentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get pricing plans
    getPricing: builder.query<ResponseDto<PricingResponse>, void>({
      query: () => '/payments/pricing',
    }),

    // Initialize subscription payment
    initializePayment: builder.mutation<InitializePaymentResponse, InitializePaymentRequest>({
      query: (body) => ({
        url: '/payments/subscribe',
        method: 'POST',
        body,
      }),
    }),

    // Verify payment
    verifyPayment: builder.query<VerifyPaymentResponse, string>({
      query: (reference) => `/payments/verify/${reference}`,
    }),
  }),
});

// Export hooks
export const {
  useGetPricingQuery,
  useInitializePaymentMutation,
  useLazyVerifyPaymentQuery,
} = paymentsApi;


















