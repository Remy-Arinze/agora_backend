'use client';

import { useState, useMemo } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { GraduationCap, Download, Award, School, Calendar, FileText, TrendingUp, BookOpen } from 'lucide-react';
import { useGetMyStudentTranscriptQuery } from '@/lib/store/api/schoolAdminApi';
import { format } from 'date-fns';

const getGradeColor = (percentage: number) => {
  if (percentage >= 90) {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  } else if (percentage >= 80) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  } else if (percentage >= 70) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  } else {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
  }
};

const getGradeLetter = (percentage: number) => {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
};

type TabType = 'grades' | 'transcript';

export default function StudentHistoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('grades');
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);

  // Fetch transcript data (contains grades grouped by school)
  const { data: transcriptResponse, isLoading } = useGetMyStudentTranscriptQuery({});
  const transcriptData = transcriptResponse?.data;

  const toggleSchool = (schoolId: string) => {
    setExpandedSchool(expandedSchool === schoolId ? null : schoolId);
    setExpandedYear(null);
  };

  const toggleYear = (yearKey: string) => {
    setExpandedYear(expandedYear === yearKey ? null : yearKey);
  };

  // Group grades by school, academic year, and term for the Grades tab
  const gradesBySchool = useMemo(() => {
    if (!transcriptData?.schools) return [];

    return transcriptData.schools.map((schoolData: any) => {
      const grades = schoolData.grades || [];
      
      // Group grades by academic year and term
      const groupedByYearTerm: Record<string, any[]> = {};
      grades.forEach((grade: any) => {
        const key = `${grade.academicYear}-${grade.term}`;
        if (!groupedByYearTerm[key]) {
          groupedByYearTerm[key] = [];
        }
        groupedByYearTerm[key].push(grade);
      });

      // Calculate averages per term
      const yearTerms = Object.entries(groupedByYearTerm).map(([key, termGrades]) => {
        const totalScore = termGrades.reduce((sum: number, g: any) => sum + g.score, 0);
        const totalMaxScore = termGrades.reduce((sum: number, g: any) => sum + g.maxScore, 0);
        const average = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
        
        return {
          key,
          academicYear: termGrades[0].academicYear,
          term: termGrades[0].term,
          grades: termGrades,
          averageScore: average,
          totalScore,
          totalMaxScore,
        };
      });

      // Sort by academic year and term
      yearTerms.sort((a, b) => {
        if (a.academicYear !== b.academicYear) {
          return b.academicYear.localeCompare(a.academicYear);
        }
        return b.term.localeCompare(a.term);
      });

      return {
        school: schoolData.school,
        enrollments: schoolData.enrollments || [],
        grades: yearTerms,
        startDate: schoolData.startDate,
        endDate: schoolData.endDate,
      };
    });
  }, [transcriptData]);

  if (isLoading) {
    return (
      <ProtectedRoute roles={['STUDENT']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <div className="text-light-text-secondary dark:text-dark-text-secondary">Loading...</div>
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
                History
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                View your complete academic history and transcripts across all schools
              </p>
            </div>
            {activeTab === 'transcript' && (
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Full Transcript
              </Button>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex gap-3">
              <Button
                variant={activeTab === 'grades' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('grades')}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Grades
              </Button>
              <Button
                variant={activeTab === 'transcript' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('transcript')}
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                Transcript
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Grades Tab */}
        {activeTab === 'grades' && (
          <div className="space-y-6">
            {gradesBySchool.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-light-text-secondary dark:text-dark-text-secondary">
                  No grades found
                </CardContent>
              </Card>
            ) : (
              gradesBySchool.map((schoolData, schoolIndex) => {
                const isExpanded = expandedSchool === schoolData.school.id;
                const isCurrentSchool = !schoolData.endDate;

                return (
                  <motion.div
                    key={schoolData.school.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: schoolIndex * 0.1 }}
                  >
                    <Card className="overflow-hidden">
                      <CardHeader
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors"
                        onClick={() => toggleSchool(schoolData.school.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <School className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                                {schoolData.school.name}
                                {isCurrentSchool && (
                                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded">
                                    Current
                                  </span>
                                )}
                              </CardTitle>
                              <div className="flex items-center gap-4 mt-2">
                                {schoolData.startDate && (
                                  <div className="flex items-center gap-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    <Calendar className="h-4 w-4" />
                                    {format(new Date(schoolData.startDate), 'yyyy')} -{' '}
                                    {schoolData.endDate
                                      ? format(new Date(schoolData.endDate), 'yyyy')
                                      : 'Present'}
                                  </div>
                                )}
                                <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                  {schoolData.grades.length} Term{schoolData.grades.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </Button>
                        </div>
                      </CardHeader>

                      {isExpanded && (
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            {schoolData.grades.map((yearTerm, yearIndex) => {
                              const yearKey = `${schoolData.school.id}-${yearTerm.key}`;
                              const isYearExpanded = expandedYear === yearKey;

                              return (
                                <motion.div
                                  key={yearTerm.key}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: yearIndex * 0.05 }}
                                >
                                  <Card className="border-l-4 border-l-blue-600 dark:border-l-blue-400">
                                    <CardHeader
                                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors"
                                      onClick={() => toggleYear(yearKey)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <CardTitle className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                                            {yearTerm.academicYear} - {yearTerm.term}
                                          </CardTitle>
                                          <div className="flex items-center gap-4 mt-2">
                                            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                              Average: <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">{yearTerm.averageScore.toFixed(1)}%</span>
                                            </div>
                                            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                              {yearTerm.grades.length} Subject{yearTerm.grades.length !== 1 ? 's' : ''}
                                            </div>
                                          </div>
                                        </div>
                                        <Button variant="ghost" size="sm">
                                          {isYearExpanded ? 'Hide Details' : 'Show Details'}
                                        </Button>
                                      </div>
                                    </CardHeader>
                                    {isYearExpanded && (
                                      <CardContent>
                                        <div className="overflow-x-auto">
                                          <table className="w-full">
                                            <thead>
                                              <tr className="border-b border-light-border dark:border-dark-border">
                                                <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                  Subject
                                                </th>
                                                <th className="text-center py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                  Assessment
                                                </th>
                                                <th className="text-center py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                  Score
                                                </th>
                                                <th className="text-center py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                  Max Score
                                                </th>
                                                <th className="text-center py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                  Grade
                                                </th>
                                                <th className="text-center py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                  Percentage
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {yearTerm.grades.map((grade: any, gradeIndex: number) => {
                                                const percentage = grade.percentage || 0;
                                                const gradeLetter = getGradeLetter(percentage);
                                                return (
                                                  <tr
                                                    key={gradeIndex}
                                                    className="border-b border-light-border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors"
                                                  >
                                                    <td className="py-3 px-4">
                                                      <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                                        {grade.subject}
                                                      </p>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                        {grade.assessmentName || 'N/A'}
                                                      </p>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                      <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                                        {grade.score}
                                                      </p>
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                                      {grade.maxScore}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                      <span
                                                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getGradeColor(
                                                          percentage
                                                        )}`}
                                                      >
                                                        {gradeLetter}
                                                      </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                      <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                                                        {percentage.toFixed(1)}%
                                                      </p>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </CardContent>
                                    )}
                                  </Card>
                                </motion.div>
                              );
                            })}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <div className="space-y-6">
            {!transcriptData ? (
              <Card>
                <CardContent className="pt-6 text-center text-light-text-secondary dark:text-dark-text-secondary">
                  No transcript data available
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Timeline View */}
                {transcriptData.schools && transcriptData.schools.length > 0 && (
                  <>
                    {transcriptData.schools.map((schoolData: any, schoolIndex: number) => {
                      const isCurrentSchool = !schoolData.endDate;
                      const isExpanded = expandedSchool === schoolData.school.id;

                      return (
                        <motion.div
                          key={schoolData.school.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: schoolIndex * 0.1 }}
                        >
                          <Card className="overflow-hidden">
                            <CardHeader
                              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors"
                              onClick={() => toggleSchool(schoolData.school.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <School className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div>
                                    <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                                      {schoolData.school.name}
                                      {isCurrentSchool && (
                                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded">
                                          Current
                                        </span>
                                      )}
                                    </CardTitle>
                                    <div className="flex items-center gap-4 mt-2">
                                      {schoolData.startDate && (
                                        <div className="flex items-center gap-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                          <Calendar className="h-4 w-4" />
                                          {format(new Date(schoolData.startDate), 'yyyy')} -{' '}
                                          {schoolData.endDate
                                            ? format(new Date(schoolData.endDate), 'yyyy')
                                            : 'Present'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm">
                                  {isExpanded ? 'Collapse' : 'Expand'}
                                </Button>
                              </div>
                            </CardHeader>

                            {isExpanded && (
                              <CardContent className="pt-0">
                                {/* Academic Years */}
                                <div className="space-y-4">
                                  <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Academic Performance
                                  </h3>
                                  {schoolData.grades && schoolData.grades.length > 0 ? (
                                    (() => {
                                      // Group grades by academic year and term
                                      const groupedByYearTerm: Record<string, any[]> = {};
                                      schoolData.grades.forEach((grade: any) => {
                                        const key = `${grade.academicYear}-${grade.term}`;
                                        if (!groupedByYearTerm[key]) {
                                          groupedByYearTerm[key] = [];
                                        }
                                        groupedByYearTerm[key].push(grade);
                                      });

                                      return Object.entries(groupedByYearTerm).map(([key, termGrades], yearIndex) => {
                                        const yearKey = `${schoolData.school.id}-${key}`;
                                        const isYearExpanded = expandedYear === yearKey;
                                        const totalScore = termGrades.reduce((sum: number, g: any) => sum + g.score, 0);
                                        const totalMaxScore = termGrades.reduce((sum: number, g: any) => sum + g.maxScore, 0);
                                        const averageScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

                                        return (
                                          <motion.div
                                            key={key}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: yearIndex * 0.05 }}
                                          >
                                            <Card className="border-l-4 border-l-blue-600 dark:border-l-blue-400">
                                              <CardHeader
                                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors"
                                                onClick={() => toggleYear(yearKey)}
                                              >
                                                <div className="flex items-center justify-between">
                                                  <div>
                                                    <CardTitle className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                                                      {termGrades[0].academicYear} - {termGrades[0].term}
                                                    </CardTitle>
                                                    <div className="flex items-center gap-4 mt-2">
                                                      <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                        Average: <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">{averageScore.toFixed(1)}%</span>
                                                      </div>
                                                      <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                        {termGrades.length} Subject{termGrades.length !== 1 ? 's' : ''}
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <Button variant="ghost" size="sm">
                                                    {isYearExpanded ? 'Hide Details' : 'Show Details'}
                                                  </Button>
                                                </div>
                                              </CardHeader>
                                              {isYearExpanded && (
                                                <CardContent>
                                                  <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                      <thead>
                                                        <tr className="border-b border-light-border dark:border-dark-border">
                                                          <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                            Subject
                                                          </th>
                                                          <th className="text-center py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                            Score
                                                          </th>
                                                          <th className="text-center py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                            Max Score
                                                          </th>
                                                          <th className="text-center py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                            Grade
                                                          </th>
                                                          <th className="text-center py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                                            Percentage
                                                          </th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {termGrades.map((grade: any, gradeIndex: number) => {
                                                          const percentage = grade.percentage || 0;
                                                          const gradeLetter = getGradeLetter(percentage);
                                                          return (
                                                            <tr
                                                              key={gradeIndex}
                                                              className="border-b border-light-border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors"
                                                            >
                                                              <td className="py-3 px-4">
                                                                <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                                                  {grade.subject}
                                                                </p>
                                                              </td>
                                                              <td className="py-3 px-4 text-center">
                                                                <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                                                  {grade.score}
                                                                </p>
                                                              </td>
                                                              <td className="py-3 px-4 text-center text-light-text-secondary dark:text-dark-text-secondary">
                                                                {grade.maxScore}
                                                              </td>
                                                              <td className="py-3 px-4 text-center">
                                                                <span
                                                                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getGradeColor(
                                                                    percentage
                                                                  )}`}
                                                                >
                                                                  {gradeLetter}
                                                                </span>
                                                              </td>
                                                              <td className="py-3 px-4 text-center">
                                                                <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                                                                  {percentage.toFixed(1)}%
                                                                </p>
                                                              </td>
                                                            </tr>
                                                          );
                                                        })}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                </CardContent>
                                              )}
                                            </Card>
                                          </motion.div>
                                        );
                                      });
                                    })()
                                  ) : (
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary">No grades available</p>
                                  )}
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        </motion.div>
                      );
                    })}
                  </>
                )}

                {/* Summary Stats */}
                {transcriptData.overallGPA !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Overall Academic Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              Schools Attended
                            </p>
                            <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                              {transcriptData.schools?.length || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              Overall GPA
                            </p>
                            <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                              {transcriptData.overallGPA.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                              Total Assessments
                            </p>
                            <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                              {transcriptData.totalCredits || 0}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

