import { useMemo, useState } from 'react';
import { useGetClassGradesQuery } from '@/lib/store/api/schoolAdminApi';
import type { GradeType } from '@/lib/store/api/schoolAdminApi';

interface UseClassGradesParams {
  schoolId: string | undefined;
  classId: string;
  activeTab: string;
}

interface UseClassGradesReturn {
  grades: any[];
  allGrades: any[];
  uniqueSequences: number[];
  gradeTypeFilter: GradeType | '';
  termFilter: string;
  sequenceFilter: number | '';
  setGradeTypeFilter: (filter: GradeType | '') => void;
  setTermFilter: (filter: string) => void;
  setSequenceFilter: (filter: number | '') => void;
  isLoading: boolean;
}

/**
 * Hook to manage class grades with filtering capabilities
 * Separates business logic for grade filtering from UI components
 */
export function useClassGrades({
  schoolId,
  classId,
  activeTab,
}: UseClassGradesParams): UseClassGradesReturn {
  const [gradeTypeFilter, setGradeTypeFilter] = useState<GradeType | ''>('');
  const [termFilter, setTermFilter] = useState<string>('');
  const [sequenceFilter, setSequenceFilter] = useState<number | ''>('');

  // Get grades for class
  const { data: gradesResponse, isLoading } = useGetClassGradesQuery(
    { 
      schoolId: schoolId!, 
      classId,
      gradeType: gradeTypeFilter || undefined,
      termId: termFilter || undefined,
    },
    { skip: !schoolId || !classId || activeTab !== 'grades' }
  );

  const allGrades = gradesResponse?.data || [];
  
  // Filter grades by sequence on frontend
  const grades = useMemo(() => {
    if (sequenceFilter === '') return allGrades;
    return allGrades.filter((grade: any) => grade.sequence === sequenceFilter);
  }, [allGrades, sequenceFilter]);
  
  // Get unique sequence numbers from grades for filter dropdown
  const uniqueSequences = useMemo(() => {
    const sequences = allGrades
      .map((g: any) => g.sequence)
      .filter((s: number | null | undefined): s is number => s !== null && s !== undefined && typeof s === 'number')
      .sort((a: number, b: number) => a - b);
    return Array.from(new Set(sequences));
  }, [allGrades]);

  return {
    grades,
    allGrades,
    uniqueSequences,
    gradeTypeFilter,
    termFilter,
    sequenceFilter,
    setGradeTypeFilter,
    setTermFilter,
    setSequenceFilter,
    isLoading,
  };
}

