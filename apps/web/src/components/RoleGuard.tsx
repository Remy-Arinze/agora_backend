'use client';

import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store/store';
import { ReactNode } from 'react';

interface RoleGuardProps {
  roles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const user = useSelector((state: RootState) => state.auth.user);

  if (!user) {
    return <>{fallback}</>;
  }

  if (!roles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

