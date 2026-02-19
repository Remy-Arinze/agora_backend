'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  Award, 
  Loader2, 
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
  User,
  MessageSquare
} from 'lucide-react';
import {
  useGetMyStudentGradesQuery,
  useGetActiveSessionQuery,
  useGetSessionsQuery,
} from '@/lib/store/api/schoolAdminApi';
import { useStudentSchoolType, getStudentTerminology } from '@/hooks/useStudentDashboard';
import { format } from 'date-fns';

interface Grade {
  id: string;
  subject: string;
  gradeType: 'CA' | 'ASSIGNMENT' | 'EXAM';
  assessmentName: string;
  assessmentDate?: string;
  score: number;
  maxScore: number;
  percentage: number;
  term: string;
  termId: string;
  academicYear: string;
  remarks?: string;
  teacher?: {
    firstName: string;
    lastName: string;
  };
}

interface SubjectResult {
  name: string;
  totalScore: number;
  totalMaxScore: number;
  percentage: number;
  grade: string;
  assessments: Grade[];
  // Breakdown by type
  caScore: number;
  caMaxScore: number;
  testScore: number;
  testMaxScore: number;
  examScore: number;
  examMaxScore: number;
}

interface TermResult {
  termId: string;
  termName: string;
  academicYear: string;
  subjects: SubjectResult[];
  totalScore: number;
  totalMaxScore: number;
  averagePercentage: number;
}

type GradeTypeFilter = 'ALL' | 'CA' | 'ASSIGNMENT' | 'EXAM';

const gradeTypeLabels: Record<string, string> = {
  CA: 'Continuous Assessment',
  ASSIGNMENT: 'Test/Assignment',
  EXAM: 'Examination',
};

const gradeTypeShortLabels: Record<string, string> = {
  CA: 'CA',
  ASSIGNMENT: 'Test',
  EXAM: 'Exam',
};

const getLetterGrade = (percentage: number): string => {
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
};

const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'B':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'C':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'D':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'CA':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'ASSIGNMENT':
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400';
    case 'EXAM':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
};

export default function StudentResultsPage() {
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [gradeTypeFilter, setGradeTypeFilter] = useState<GradeTypeFilter>('ALL');
  
  // Get school type and school ID from student's enrollment (not localStorage)
  const { schoolType: currentType, schoolId, isLoading: isLoadingSchoolType } = useStudentSchoolType();
  const terminology = getStudentTerminology(currentType);

  // Get active session
  const { data: activeSessionResponse } = useGetActiveSessionQuery(
    { schoolId: schoolId! },
    { skip: !schoolId }
  );
  const activeSession = activeSessionResponse?.data;

  // Get all sessions for term selector
  const { data: sessionsResponse } = useGetSessionsQuery(
    { schoolId: schoolId || '' },
    { skip: !schoolId }
  );

  // Get all grades (published only from backend)
  const { 
    data: gradesResponse, 
    isLoading: isLoadingGrades,
    error: gradesError 
  } = useGetMyStudentGradesQuery({});
  const grades = gradesResponse?.data || [];

  // Get available grade types from data
  const availableGradeTypes = useMemo(() => {
    const types = new Set<string>();
    grades.forEach((grade: Grade) => {
      types.add(grade.gradeType);
    });
    return Array.from(types);
  }, [grades]);

  // Filter grades by type
  const filteredGrades = useMemo(() => {
    if (gradeTypeFilter === 'ALL') return grades;
    return grades.filter((grade: Grade) => grade.gradeType === gradeTypeFilter);
  }, [grades, gradeTypeFilter]);

  // Group grades by term
  const termResults = useMemo(() => {
    const termMap = new Map<string, TermResult>();

    filteredGrades.forEach((grade: Grade) => {
      const termKey = grade.termId || grade.term || 'Unknown';
      
      if (!termMap.has(termKey)) {
        termMap.set(termKey, {
          termId: grade.termId || '',
          termName: grade.term || 'Unknown Term',
          academicYear: grade.academicYear || '',
          subjects: [],
          totalScore: 0,
          totalMaxScore: 0,
          averagePercentage: 0,
        });
      }

      const termResult = termMap.get(termKey)!;
      
      // Find or create subject entry
      let subjectEntry = termResult.subjects.find(s => s.name === grade.subject);
      if (!subjectEntry) {
        subjectEntry = {
          name: grade.subject,
          totalScore: 0,
          totalMaxScore: 0,
          percentage: 0,
          grade: 'F',
          assessments: [],
          caScore: 0,
          caMaxScore: 0,
          testScore: 0,
          testMaxScore: 0,
          examScore: 0,
          examMaxScore: 0,
        };
        termResult.subjects.push(subjectEntry);
      }

      // Add assessment to subject
      subjectEntry.assessments.push(grade);
      subjectEntry.totalScore += grade.score;
      subjectEntry.totalMaxScore += grade.maxScore;

      // Track by type
      if (grade.gradeType === 'CA') {
        subjectEntry.caScore += grade.score;
        subjectEntry.caMaxScore += grade.maxScore;
      } else if (grade.gradeType === 'ASSIGNMENT') {
        subjectEntry.testScore += grade.score;
        subjectEntry.testMaxScore += grade.maxScore;
      } else if (grade.gradeType === 'EXAM') {
        subjectEntry.examScore += grade.score;
        subjectEntry.examMaxScore += grade.maxScore;
      }
    });

    // Calculate percentages and grades for each subject and term
    termMap.forEach((termResult) => {
      let termTotalScore = 0;
      let termTotalMaxScore = 0;

      termResult.subjects.forEach((subject) => {
        if (subject.totalMaxScore > 0) {
          subject.percentage = (subject.totalScore / subject.totalMaxScore) * 100;
          subject.grade = getLetterGrade(subject.percentage);
        }
        termTotalScore += subject.totalScore;
        termTotalMaxScore += subject.totalMaxScore;

        // Sort assessments by date (newest first)
        subject.assessments.sort((a, b) => {
          if (a.assessmentDate && b.assessmentDate) {
            return new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime();
          }
          return 0;
        });
      });

      termResult.totalScore = termTotalScore;
      termResult.totalMaxScore = termTotalMaxScore;
      if (termTotalMaxScore > 0) {
        termResult.averagePercentage = (termTotalScore / termTotalMaxScore) * 100;
      }

      // Sort subjects by name
      termResult.subjects.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Convert to array and sort by academic year and term
    return Array.from(termMap.values()).sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return b.academicYear.localeCompare(a.academicYear);
      }
      return b.termName.localeCompare(a.termName);
    });
  }, [filteredGrades]);

  // Set default selected term
  const effectiveTermId = selectedTermId || activeSession?.term?.id || termResults[0]?.termId || '';
  
  // Get current results for selected term
  const currentResults = useMemo(() => {
    if (!effectiveTermId) return termResults[0];
    return termResults.find(t => t.termId === effectiveTermId) || termResults[0];
  }, [termResults, effectiveTermId]);

  const toggleSubjectExpanded = (subjectName: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subjectName)) {
        next.delete(subjectName);
      } else {
        next.add(subjectName);
      }
      return next;
    });
  };

  const isLoading = isLoadingSchoolType || isLoadingGrades;

  if (isLoading) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-blue-600 mx-auto mb-4 animate-spin" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Loading results...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (gradesError) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Unable to load results
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['STUDENT']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                My Results
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                View your academic performance by subject and assessment type
              </p>
            </div>
            {currentResults && currentResults.subjects.length > 0 && (
              <Button variant="ghost" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
        </motion.div>

        {grades.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                  No Results Available
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Your grades will appear here once your teachers publish them.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filters Section */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Term Selector */}
                  <div className="flex-1">
                    <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 block">
                      {terminology.periodSingular}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {termResults.map((result) => (
                        <Button
                          key={result.termId || result.termName}
                          variant={effectiveTermId === result.termId ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => setSelectedTermId(result.termId)}
                        >
                          {result.termName} {result.academicYear && `(${result.academicYear})`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Grade Type Filter */}
                  {availableGradeTypes.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 flex items-center gap-1">
                        <Filter className="h-4 w-4" />
                        Assessment Type
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={gradeTypeFilter === 'ALL' ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => setGradeTypeFilter('ALL')}
                        >
                          All
                        </Button>
                        {availableGradeTypes.includes('CA') && (
                          <Button
                            variant={gradeTypeFilter === 'CA' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setGradeTypeFilter('CA')}
                          >
                            CA
                          </Button>
                        )}
                        {availableGradeTypes.includes('ASSIGNMENT') && (
                          <Button
                            variant={gradeTypeFilter === 'ASSIGNMENT' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setGradeTypeFilter('ASSIGNMENT')}
                          >
                            Test
                          </Button>
                        )}
                        {availableGradeTypes.includes('EXAM') && (
                          <Button
                            variant={gradeTypeFilter === 'EXAM' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setGradeTypeFilter('EXAM')}
                          >
                            Exam
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {currentResults ? (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            Average Score
                          </p>
                          <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                            {currentResults.averagePercentage.toFixed(1)}%
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            Overall Grade
                          </p>
                          <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                            {getLetterGrade(currentResults.averagePercentage)}
                          </p>
                        </div>
                        <Award className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            Total Points
                          </p>
                          <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                            {currentResults.totalScore.toFixed(0)}
                            <span className="text-lg text-light-text-secondary dark:text-dark-text-secondary">
                              {' '}/ {currentResults.totalMaxScore.toFixed(0)}
                            </span>
                          </p>
                        </div>
                        <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Subject Results */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                      Subject Breakdown - {currentResults.termName}
                      {gradeTypeFilter !== 'ALL' && (
                        <span className="ml-2 text-sm font-normal text-light-text-secondary dark:text-dark-text-secondary">
                          ({gradeTypeLabels[gradeTypeFilter]} only)
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentResults.subjects.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-light-text-secondary dark:text-dark-text-secondary">
                          No results available for this {terminology.periodSingular.toLowerCase()}
                          {gradeTypeFilter !== 'ALL' && ` with ${gradeTypeLabels[gradeTypeFilter]} filter`}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {currentResults.subjects.map((subject, index) => (
                          <motion.div
                            key={subject.name}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border border-light-border dark:border-dark-border rounded-lg overflow-hidden"
                          >
                            {/* Subject Header - Clickable */}
                            <button
                              onClick={() => toggleSubjectExpanded(subject.name)}
                              className="w-full p-4 flex items-center justify-between bg-[var(--light-bg)] dark:bg-[var(--dark-surface)] hover:bg-[var(--light-hover)] dark:hover:bg-[var(--dark-hover)] transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  {expandedSubjects.has(subject.name) ? (
                                    <ChevronDown className="h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
                                  )}
                                  <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                                    {subject.name}
                                  </h3>
                                </div>
                                <span className="text-sm text-light-text-muted dark:text-dark-text-muted">
                                  {subject.assessments.length} assessment{subject.assessments.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-6">
                                {/* Type breakdown badges - show only when filter is ALL */}
                                {gradeTypeFilter === 'ALL' && (
                                  <div className="hidden md:flex items-center gap-2">
                                    {subject.caMaxScore > 0 && (
                                      <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                        CA: {subject.caScore.toFixed(0)}/{subject.caMaxScore.toFixed(0)}
                                      </span>
                                    )}
                                    {subject.testMaxScore > 0 && (
                                      <span className="text-xs px-2 py-1 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400">
                                        Test: {subject.testScore.toFixed(0)}/{subject.testMaxScore.toFixed(0)}
                                      </span>
                                    )}
                                    {subject.examMaxScore > 0 && (
                                      <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                                        Exam: {subject.examScore.toFixed(0)}/{subject.examMaxScore.toFixed(0)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Total Score */}
                                <div className="text-right">
                                  <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                                    {subject.totalScore.toFixed(1)} / {subject.totalMaxScore.toFixed(0)}
                                  </p>
                                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    {subject.percentage.toFixed(1)}%
                                  </p>
                                </div>
                                
                                {/* Grade Badge */}
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getGradeColor(subject.grade)}`}>
                                  {subject.grade}
                                </span>
                              </div>
                            </button>

                            {/* Expanded Assessment Details */}
                            <AnimatePresence>
                              {expandedSubjects.has(subject.name) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="border-t border-light-border dark:border-dark-border bg-[var(--light-surface)] dark:bg-[var(--dark-bg)]">
                                    {/* Mobile type breakdown */}
                                    {gradeTypeFilter === 'ALL' && (
                                      <div className="md:hidden px-4 py-3 flex flex-wrap gap-2 border-b border-light-border dark:border-dark-border">
                                        {subject.caMaxScore > 0 && (
                                          <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                            CA: {subject.caScore.toFixed(0)}/{subject.caMaxScore.toFixed(0)}
                                          </span>
                                        )}
                                        {subject.testMaxScore > 0 && (
                                          <span className="text-xs px-2 py-1 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400">
                                            Test: {subject.testScore.toFixed(0)}/{subject.testMaxScore.toFixed(0)}
                                          </span>
                                        )}
                                        {subject.examMaxScore > 0 && (
                                          <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                                            Exam: {subject.examScore.toFixed(0)}/{subject.examMaxScore.toFixed(0)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Assessment List */}
                                    <div className="divide-y divide-light-border dark:divide-dark-border">
                                      {subject.assessments.map((assessment) => (
                                        <div
                                          key={assessment.id}
                                          className="px-4 py-3 hover:bg-[var(--light-hover)] dark:hover:bg-[var(--dark-hover)] transition-colors"
                                        >
                                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${getTypeColor(assessment.gradeType)}`}>
                                                  {gradeTypeShortLabels[assessment.gradeType] || assessment.gradeType}
                                                </span>
                                                <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                                  {assessment.assessmentName || gradeTypeLabels[assessment.gradeType]}
                                                </h4>
                                              </div>
                                              
                                              <div className="flex items-center gap-4 mt-1 text-xs text-light-text-muted dark:text-dark-text-muted">
                                                {assessment.assessmentDate && (
                                                  <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(assessment.assessmentDate), 'MMM d, yyyy')}
                                                  </span>
                                                )}
                                                {assessment.teacher && (
                                                  <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {assessment.teacher.firstName} {assessment.teacher.lastName}
                                                  </span>
                                                )}
                                              </div>
                                              
                                              {assessment.remarks && (
                                                <div className="mt-2 flex items-start gap-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                  <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                  <p className="italic">&ldquo;{assessment.remarks}&rdquo;</p>
                                                </div>
                                              )}
                                            </div>
                                            
                                            <div className="flex items-center gap-4 md:text-right">
                                              <div>
                                                <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                                                  {assessment.score} / {assessment.maxScore}
                                                </p>
                                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                  {((assessment.score / assessment.maxScore) * 100).toFixed(1)}%
                                                </p>
                                              </div>
                                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getGradeColor(getLetterGrade((assessment.score / assessment.maxScore) * 100))}`}>
                                                {getLetterGrade((assessment.score / assessment.maxScore) * 100)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      Select a {terminology.periodSingular.toLowerCase()} to view results
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
