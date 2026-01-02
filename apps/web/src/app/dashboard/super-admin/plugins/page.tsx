'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Puzzle,
  Sparkles,
  Smartphone,
  CreditCard,
  BookOpen,
  Building2,
  CheckCircle2,
  XCircle,
  Users,
} from 'lucide-react';

// Mock data - will be replaced with API calls later
const allPlugins = [
  {
    id: '1',
    name: 'Socrates AI',
    subtitle: "The Teacher's Assistant",
    description: 'AI-powered lesson planning and grading assistant',
    monetization: 'Monthly subscription per teacher seat',
    icon: Sparkles,
    totalSchools: 12,
    activeSchools: 10,
    schools: [
      { id: '1', name: 'Test Academy', status: 'active' },
      { id: '2', name: 'Elite Secondary School', status: 'active' },
      { id: '3', name: 'Premier High School', status: 'active' },
      { id: '4', name: 'Lagos International School', status: 'active' },
      { id: '5', name: 'Abuja Academy', status: 'active' },
      { id: '6', name: 'Port Harcourt High', status: 'active' },
      { id: '7', name: 'Ibadan Grammar School', status: 'active' },
      { id: '8', name: 'Kano Secondary School', status: 'active' },
      { id: '9', name: 'Enugu College', status: 'active' },
      { id: '10', name: 'Kaduna Academy', status: 'active' },
      { id: '11', name: 'Benin City School', status: 'inactive' },
      { id: '12', name: 'Calabar High School', status: 'inactive' },
    ],
  },
  {
    id: '2',
    name: 'RollCall',
    subtitle: 'Attendance System',
    description: 'Biometric and card-based attendance tracking with SMS alerts',
    monetization: 'Fee per SMS sent + Hardware sales (ID Cards)',
    icon: Smartphone,
    totalSchools: 8,
    activeSchools: 7,
    schools: [
      { id: '1', name: 'Test Academy', status: 'active' },
      { id: '2', name: 'Elite Secondary School', status: 'active' },
      { id: '3', name: 'Premier High School', status: 'active' },
      { id: '4', name: 'Lagos International School', status: 'active' },
      { id: '5', name: 'Abuja Academy', status: 'active' },
      { id: '6', name: 'Port Harcourt High', status: 'active' },
      { id: '7', name: 'Ibadan Grammar School', status: 'active' },
      { id: '8', name: 'Kano Secondary School', status: 'inactive' },
    ],
  },
  {
    id: '3',
    name: 'Bursary Pro',
    subtitle: 'School Finance',
    description: 'Comprehensive financial management for schools',
    monetization: 'Higher tier subscription',
    icon: CreditCard,
    totalSchools: 5,
    activeSchools: 4,
    schools: [
      { id: '1', name: 'Test Academy', status: 'active' },
      { id: '2', name: 'Elite Secondary School', status: 'active' },
      { id: '3', name: 'Premier High School', status: 'active' },
      { id: '4', name: 'Lagos International School', status: 'active' },
      { id: '5', name: 'Abuja Academy', status: 'inactive' },
    ],
  },
  {
    id: '4',
    name: 'PrepMaster',
    subtitle: 'CBT Engine',
    description: 'Computer-Based Testing platform for exam preparation',
    monetization: 'Per-student subscription or school-wide license',
    icon: BookOpen,
    totalSchools: 3,
    activeSchools: 2,
    schools: [
      { id: '1', name: 'Test Academy', status: 'active' },
      { id: '2', name: 'Elite Secondary School', status: 'active' },
      { id: '3', name: 'Premier High School', status: 'inactive' },
    ],
  },
];

export default function PluginManagementPage() {
  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Plugin Management
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            View all plugins and see which schools are using them
          </p>
        </motion.div>

        {/* Plugins List */}
        <div className="space-y-6">
          {allPlugins.map((plugin, index) => {
            const Icon = plugin.icon;
            return (
              <motion.div
                key={plugin.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">
                            {plugin.name}
                          </CardTitle>
                          <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-1">
                            {plugin.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                              Total Schools
                            </p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">
                              {plugin.totalSchools}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                              Active
                            </p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {plugin.activeSchools}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-dark-text-secondary mb-6">
                      {plugin.description}
                    </p>
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-gray-900 dark:text-dark-text-primary mb-2">
                        Monetization:
                      </p>
                      <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                        {plugin.monetization}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text-primary">
                          Schools Using This Plugin ({plugin.schools.length})
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {plugin.schools.map((school) => (
                          <Link
                            key={school.id}
                            href={`/dashboard/super-admin/schools/${school.id}`}
                            className="block"
                          >
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-surface rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface/80 transition-colors cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-gray-600 dark:text-dark-text-secondary" />
                                <span className="text-sm font-medium text-gray-900 dark:text-dark-text-primary">
                                  {school.name}
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  school.status === 'active'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                }`}
                              >
                                {school.status === 'active' ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                                {school.status}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </ProtectedRoute>
  );
}

