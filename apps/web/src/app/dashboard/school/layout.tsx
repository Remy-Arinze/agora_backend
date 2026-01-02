'use client';

import { ProtectedSchoolRoute } from '@/components/permissions/ProtectedSchoolRoute';

/**
 * Layout for school admin pages
 * Applies permission-based route protection to all school admin routes
 */
export default function SchoolAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedSchoolRoute>
      {children}
    </ProtectedSchoolRoute>
  );
}

