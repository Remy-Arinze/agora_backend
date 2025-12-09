'use client';

import React from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface NoTimetableMessageProps {
  classLevelId?: string;
}

export function NoTimetableMessage({ classLevelId }: NoTimetableMessageProps) {
  return (
    <div className="text-center py-12 px-6">
      <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
        <Calendar className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
        No Timetable Set Up
      </h3>
      
      <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6 max-w-md mx-auto">
        Create a timetable for this class first. The curriculum will be based on 
        the subjects scheduled in the timetable.
      </p>
      
      <Link href={`/dashboard/school/timetables${classLevelId ? `?classLevelId=${classLevelId}` : ''}`}>
        <Button variant="primary">
          Go to Timetables
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Link>
      
      <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-4">
        Once you&apos;ve assigned subjects to the timetable, they&apos;ll appear here.
      </p>
    </div>
  );
}

