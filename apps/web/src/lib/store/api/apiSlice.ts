import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { setCredentials, logout } from '../slices/authSlice';

// Get tenant ID from subdomain or localStorage
const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // Try to get from localStorage first (set after login)
  const stored = localStorage.getItem('tenantId');
  if (stored) return stored;

  // Fallback: extract from subdomain
  const hostname = window.location.hostname;
  const subdomain = hostname.split('.')[0];
  
  // Ignore common non-tenant subdomains
  if (['localhost', 'www', 'api', 'app'].includes(subdomain)) {
    return null;
  }

  return subdomain;
};

const baseQuery = fetchBaseQuery({
  baseUrl: (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000/api',
  prepareHeaders: (headers, { getState }) => {
    // Get token from Redux state
    const state = getState() as { auth: { accessToken?: string | null; token?: string | null } };
    const token = state?.auth?.accessToken || state?.auth?.token;

    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }

    // Inject tenant ID from subdomain
    const tenantId = getTenantId();
    if (tenantId) {
      headers.set('x-tenant-id', tenantId);
    }

    // Only set Content-Type for JSON requests (not FormData)
    const contentType = headers.get('Content-Type');
    if (!contentType || contentType === 'application/json') {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  // If we get a 401, try to refresh the token
  if (result.error && result.error.status === 401) {
    const state = api.getState() as { auth: { refreshToken?: string | null; user?: any } };
    const refreshToken = state.auth.refreshToken;

    if (refreshToken) {
      try {
        // Try to refresh the token
        const refreshResult = await baseQuery(
          {
            url: '/auth/refresh',
            method: 'POST',
            body: { refreshToken },
          },
          api,
          extraOptions
        );

        if (refreshResult.data) {
          const data = refreshResult.data as { accessToken: string; refreshToken: string };
          
          // Update the store with new tokens
          api.dispatch(
            setCredentials({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              user: state.auth.user, // Keep existing user data
            })
          );

          // Retry the original query with new token
          result = await baseQuery(args, api, extraOptions);
        } else {
          // Refresh failed, logout user
          api.dispatch(logout());
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login?expired=true';
          }
        }
      } catch (error) {
        // Refresh failed, logout user
        api.dispatch(logout());
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login?expired=true';
        }
      }
    } else {
      // No refresh token, logout user
      api.dispatch(logout());
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login?expired=true';
      }
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Student', 'School', 'User', 'Timetable', 'Event', 'Session', 'ClassLevel', 'ClassArm', 'Subject', 'Room', 'Class', 'ClassResource', 'StudentResource', 'Permission', 'Curriculum', 'Grade', 'Transfer', 'Subscription', 'TeacherSubject', 'Faculty', 'Department'],
  endpoints: () => ({}),
});

