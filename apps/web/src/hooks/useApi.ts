'use client';

import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';
import { useCallback } from 'react';

interface ApiOptions extends RequestInit {
  requireAuth?: boolean;
}

export function useApi() {
  const token = useSelector((state: RootState) => state.auth.token);

  const apiCall = useCallback(
    async <T = unknown>(
      endpoint: string,
      options: ApiOptions = {}
    ): Promise<{ success: boolean; data?: T; message?: string }> => {
      const { requireAuth = true, ...fetchOptions } = options;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      };

      if (requireAuth && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Get tenant ID from subdomain or localStorage
      const getTenantId = (): string | null => {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem('tenantId');
        if (stored) return stored;
        const hostname = window.location.hostname;
        const subdomain = hostname.split('.')[0];
        if (['localhost', 'www', 'api', 'app'].includes(subdomain)) {
          return null;
        }
        return subdomain;
      };

      const tenantId = getTenantId();
      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
      }

      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const response = await fetch(`${baseUrl}${endpoint}`, {
          ...fetchOptions,
          headers,
          // Include credentials to send httpOnly cookies (refresh token)
          credentials: 'include',
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            message: data.message || 'Request failed',
          };
        }

        return {
          success: true,
          data: data.data,
          message: data.message,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Network error',
        };
      }
    },
    [token]
  );

  return { apiCall };
}

