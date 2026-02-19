'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { Clock, Loader2, AlertCircle } from 'lucide-react';
import {
  useGetSessionsQuery,
  useGetMyStudentTimetableQuery,
} from '@/lib/store/api/schoolAdminApi';
import { TeacherTimetableGrid } from '@/components/timetable/TeacherTimetableGrid';
import { useStudentDashboard, getStudentTerminology } from '@/hooks/useStudentDashboard';

export default function StudentTimetablePage() {
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  // Use unified dashboard hook - single source of truth for student data
  const {
    school,
    schoolType,
    activeTerm,
    timetable: dashboardTimetable,
    isLoading: isDashboardLoading,
    hasError,
    errorMessage,
  } = useStudentDashboard();

  const schoolId = school?.id;
  const terminology = getStudentTerminology(schoolType);

  // Get all sessions to populate term selector (for selecting different terms)
  const { data: sessionsResponse } = useGetSessionsQuery(
    { schoolId: schoolId || '' },
    { skip: !schoolId }
  );

  // Determine which term to use (selected or active from dashboard)
  const currentTermId = selectedTermId || activeTerm?.id || '';

  // If user selected a different term, fetch that timetable
  const needsSeparateFetch = selectedTermId && selectedTermId !== activeTerm?.id;
  
  const { 
    data: selectedTermTimetableResponse, 
    isLoading: isLoadingSelectedTerm,
  } = useGetMyStudentTimetableQuery(
    { termId: selectedTermId },
    { skip: !needsSeparateFetch || !selectedTermId }
  );

  // Use selected term's timetable if fetched, otherwise use dashboard's timetable
  const timetable = needsSeparateFetch 
    ? (selectedTermTimetableResponse?.data || [])
    : dashboardTimetable;

  const isLoading = isDashboardLoading || (needsSeparateFetch && isLoadingSelectedTerm);

  // Extract all terms from sessions for selector - filtered by school type and deduplicated
  const allTerms = useMemo(() => {
    if (!sessionsResponse?.data) return [];
    
    // Filter sessions by current school type to avoid duplicates
    const filteredSessions = sessionsResponse.data.filter((session: any) => {
      if (!schoolType) return !session.schoolType;
      return session.schoolType === schoolType;
    });
    
    // Deduplicate sessions by name (keep first/latest)
    const uniqueSessionsMap = new Map<string, any>();
    filteredSessions.forEach((session: any) => {
      if (!uniqueSessionsMap.has(session.name)) {
        uniqueSessionsMap.set(session.name, session);
      }
    });
    
    const terms: Array<{ id: string; name: string; sessionName: string }> = [];
    Array.from(uniqueSessionsMap.values()).forEach((session: any) => {
      if (session.terms) {
        session.terms.forEach((term: any) => {
          terms.push({
            id: term.id,
            name: term.name,
            sessionName: session.name,
          });
        });
      }
    });
    
    // Sort by session name and term name
    return terms.sort((a, b) => {
      if (a.sessionName !== b.sessionName) {
        return b.sessionName.localeCompare(a.sessionName);
      }
      return b.name.localeCompare(a.name);
    });
  }, [sessionsResponse, schoolType]);

  if (isLoading) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4 animate-spin" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Loading timetable...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (hasError) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              {errorMessage || 'Unable to load timetable'}
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['STUDENT']}>
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            My Timetable
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            View your weekly class schedule
          </p>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Weekly Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timetable.length > 0 ? (
              <TeacherTimetableGrid
                timetable={timetable}
                schoolType={schoolType}
                isLoading={isLoading}
                allTerms={allTerms}
                selectedTermId={currentTermId}
                onTermChange={setSelectedTermId}
                activeTermId={activeTerm?.id}
                terminology={terminology}
              />
            ) : (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  No timetable available for the selected {terminology.periodSingular.toLowerCase()}
                </p>
                {!currentTermId && (
                  <p className="text-sm text-light-text-muted dark:text-dark-text-muted mt-2">
                    Please select a {terminology.periodSingular.toLowerCase()} from the dropdown above to view your timetable.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
