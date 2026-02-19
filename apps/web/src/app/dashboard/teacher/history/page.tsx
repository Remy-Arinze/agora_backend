'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { GraduationCap, Download, Award, School, Calendar, FileText, TrendingUp, Users, BookOpen } from 'lucide-react';

// Mock data - will be replaced with API calls later
// This represents the complete teaching history across all schools
const teachingHistory = [
  {
    schoolId: '1',
    schoolName: 'Greenfield Primary School',
    schoolType: 'Primary',
    startDate: '2018-09-01',
    endDate: '2021-07-31',
    subject: 'Mathematics',
    certificates: [
      {
        id: '1',
        name: 'Teacher of the Year 2020',
        issueDate: '2020-12-15',
        issuer: 'Greenfield Primary School',
        fileUrl: '#',
      },
    ],
    academicYears: [
      {
        year: '2020-2021',
        classLevels: ['Primary 5', 'Primary 6'],
        studentsTaught: 68,
        averagePerformance: 88.5,
        achievements: ['Best Mathematics Teacher', '100% Pass Rate'],
      },
      {
        year: '2019-2020',
        classLevels: ['Primary 4', 'Primary 5'],
        studentsTaught: 65,
        averagePerformance: 85.2,
        achievements: ['Excellence in Teaching'],
      },
      {
        year: '2018-2019',
        classLevels: ['Primary 3', 'Primary 4'],
        studentsTaught: 62,
        averagePerformance: 82.8,
        achievements: [],
      },
    ],
  },
  {
    schoolId: '2',
    schoolName: 'Riverside Junior Secondary School',
    schoolType: 'Junior Secondary',
    startDate: '2021-09-01',
    endDate: '2024-07-31',
    subject: 'Mathematics',
    certificates: [
      {
        id: '2',
        name: 'Outstanding Teacher Award',
        issueDate: '2023-12-10',
        issuer: 'Riverside Junior Secondary School',
        fileUrl: '#',
      },
    ],
    academicYears: [
      {
        year: '2023-2024',
        classLevels: ['JSS2', 'JSS3'],
        studentsTaught: 75,
        averagePerformance: 90.2,
        achievements: ['Teacher of the Year', 'Highest Pass Rate'],
      },
      {
        year: '2022-2023',
        classLevels: ['JSS1', 'JSS2'],
        studentsTaught: 72,
        averagePerformance: 87.5,
        achievements: ['Excellence Award'],
      },
      {
        year: '2021-2022',
        classLevels: ['JSS1'],
        studentsTaught: 38,
        averagePerformance: 84.3,
        achievements: [],
      },
    ],
  },
  {
    schoolId: '3',
    schoolName: 'Elite Senior Secondary School',
    schoolType: 'Senior Secondary',
    startDate: '2024-09-01',
    endDate: null, // Current school
    subject: 'Mathematics',
    certificates: [],
    academicYears: [
      {
        year: '2024-2025',
        classLevels: ['SS1', 'SS2'],
        studentsTaught: 60,
        averagePerformance: 89.8,
        achievements: [],
      },
    ],
  },
];

export default function TeacherHistoryPage() {
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);

  const toggleSchool = (schoolId: string) => {
    setExpandedSchool(expandedSchool === schoolId ? null : schoolId);
    setExpandedYear(null);
  };

  const toggleYear = (yearKey: string) => {
    setExpandedYear(expandedYear === yearKey ? null : yearKey);
  };

  return (
    <ProtectedRoute roles={['TEACHER']}>
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
                Teaching History
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                Complete teaching history across all schools and positions
              </p>
            </div>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download Full History
            </Button>
          </div>
        </motion.div>

        {/* Timeline View */}
        <div className="space-y-6">
          {teachingHistory.map((school, schoolIndex) => {
            const isCurrentSchool = school.endDate === null;
            const isExpanded = expandedSchool === school.schoolId;

            return (
              <motion.div
                key={school.schoolId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: schoolIndex * 0.1 }}
              >
                <Card className="overflow-hidden">
                  <CardHeader
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-surface/50 transition-colors"
                    onClick={() => toggleSchool(school.schoolId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <School className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                            {school.schoolName}
                            {isCurrentSchool && (
                              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded">
                                Current
                              </span>
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              <Calendar className="h-4 w-4" />
                              {new Date(school.startDate).getFullYear()} -{' '}
                              {school.endDate
                                ? new Date(school.endDate).getFullYear()
                                : 'Present'}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              <BookOpen className="h-4 w-4" />
                              {school.subject}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {school.certificates.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            <Award className="h-4 w-4" />
                            {school.certificates.length} Award
                            {school.certificates.length > 1 ? 's' : ''}
                          </div>
                        )}
                        <Button variant="ghost" size="sm">
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      {/* Certificates Section */}
                      {school.certificates.length > 0 && (
                        <div className="mb-6 pb-6 border-b border-light-border dark:border-dark-border">
                          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4 flex items-center gap-2">
                            <Award className="h-5 w-5" />
                            Awards & Certificates
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {school.certificates.map((certificate) => (
                              <motion.div
                                key={certificate.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg"
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                      {certificate.name}
                                    </h4>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                      Issued by: {certificate.issuer}
                                    </p>
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                      Date: {new Date(certificate.issueDate).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <Button variant="ghost" size="sm">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Academic Years */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Teaching Performance
                        </h3>
                        {school.academicYears.map((academicYear, yearIndex) => {
                          const yearKey = `${school.schoolId}-${academicYear.year}`;
                          const isYearExpanded = expandedYear === yearKey;

                          return (
                            <motion.div
                              key={yearKey}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: yearIndex * 0.05 }}
                            >
                              <Card className="border-l-4 border-l-blue-600 dark:border-l-blue-400">
                                <CardHeader
                                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-surface/50 transition-colors"
                                  onClick={() => toggleYear(yearKey)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <CardTitle className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                                        {academicYear.year}
                                      </CardTitle>
                                      <div className="flex items-center gap-4 mt-2">
                                        <div className="flex items-center gap-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                          <BookOpen className="h-4 w-4" />
                                          Classes: {academicYear.classLevels.join(', ')}
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                          <Users className="h-4 w-4" />
                                          Students: {academicYear.studentsTaught}
                                        </div>
                                        <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                          Avg Performance: <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">{academicYear.averagePerformance}%</span>
                                        </div>
                                      </div>
                                      {academicYear.achievements.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {academicYear.achievements.map((achievement, idx) => (
                                            <span
                                              key={idx}
                                              className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded"
                                            >
                                              {achievement}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Button variant="ghost" size="sm">
                                      {isYearExpanded ? 'Hide Details' : 'Show Details'}
                                    </Button>
                                  </div>
                                </CardHeader>
                                {isYearExpanded && (
                                  <CardContent>
                                    <div className="space-y-2">
                                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                        <strong>Classes Taught:</strong> {academicYear.classLevels.join(', ')}
                                      </p>
                                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                        <strong>Total Students:</strong> {academicYear.studentsTaught}
                                      </p>
                                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                        <strong>Average Student Performance:</strong> {academicYear.averagePerformance}%
                                      </p>
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
          })}
        </div>

        {/* Summary Stats */}
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
                Overall Teaching Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Schools Taught At
                  </p>
                  <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {teachingHistory.length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Total Awards
                  </p>
                  <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {teachingHistory.reduce((sum, school) => sum + school.certificates.length, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Current Average Performance
                  </p>
                  <p className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {teachingHistory
                      .find((s) => s.endDate === null)
                      ?.academicYears[0]?.averagePerformance.toFixed(1) || 'N/A'}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}

