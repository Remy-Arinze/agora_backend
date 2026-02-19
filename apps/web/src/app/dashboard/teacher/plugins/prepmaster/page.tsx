'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { BookOpen, Plus, FileText, BarChart3, Users } from 'lucide-react';

// Mock data
const mockTests = [
  {
    id: '1',
    name: 'JAMB Practice Test - Mathematics',
    subject: 'Mathematics',
    questions: 50,
    duration: 120,
    studentsCompleted: 25,
    averageScore: 72.5,
    createdDate: '2024-03-10',
  },
  {
    id: '2',
    name: 'WAEC Mock - English Language',
    subject: 'English Language',
    questions: 100,
    duration: 180,
    studentsCompleted: 30,
    averageScore: 68.3,
    createdDate: '2024-03-12',
  },
];

export default function PrepMasterPage() {
  const [tests] = useState(mockTests);

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
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  PrepMaster
                </h1>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Computer-Based Testing platform
                </p>
              </div>
            </div>
            <Button variant="primary" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Test
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Total Tests
                  </p>
                  <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mt-1">
                    {tests.length}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Students Completed
                  </p>
                  <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mt-1">
                    {tests.reduce((sum, test) => sum + test.studentsCompleted, 0)}
                  </p>
                </div>
                <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Average Score
                  </p>
                  <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mt-1">
                    {(tests.reduce((sum, test) => sum + test.averageScore, 0) / tests.length).toFixed(1)}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tests List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
              My Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tests.map((test, index) => (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface/80 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                        {test.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <span>{test.subject}</span>
                        <span>•</span>
                        <span>{test.questions} Questions</span>
                        <span>•</span>
                        <span>{test.duration} minutes</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          Avg Score
                        </p>
                        <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                          {test.averageScore}%
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        View Results →
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

