'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentGradesPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to results page
    router.replace('/dashboard/student/results');
  }, [router]);

  return null;
}

