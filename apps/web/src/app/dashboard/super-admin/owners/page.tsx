'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';

// Mock data - will be replaced with API calls later
const mockSchools = [
  {
    id: '1',
    name: 'Test Academy',
    subdomain: 'testacademy',
    city: 'Lagos',
    state: 'Lagos',
    students: 1250,
    teachers: 45,
    status: 'active' as const,
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Elite Secondary School',
    subdomain: 'elite',
    city: 'Abuja',
    state: 'FCT',
    students: 890,
    teachers: 32,
    status: 'active' as const,
    createdAt: '2024-02-20',
  },
  {
    id: '3',
    name: 'Premier High School',
    subdomain: 'premier',
    city: 'Port Harcourt',
    state: 'Rivers',
    students: 2100,
    teachers: 78,
    status: 'active' as const,
    createdAt: '2024-01-10',
  },
];

export default function OwnersPage() {
  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            School Owners
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            Manage school administrator accounts
          </p>
        </motion.div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
                School Owners
              </CardTitle>
              <Button size="sm">Add Owner</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockSchools.map((school) => (
                <div
                  key={school.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        {school.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-dark-text-primary">
                        {school.name} Admin
                      </p>
                      <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                        admin@{school.subdomain}.agora.com
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      View Profile
                    </Button>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

