'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FadeInUp } from '@/components/ui/FadeInUp';

interface School {
  id: string;
  name: string;
  subdomain: string;
  city: string;
  state: string;
  students?: number;
  teachers: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface SchoolsTableProps {
  schools: School[];
}

export function SchoolsTable({ schools }: SchoolsTableProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
            Schools
          </CardTitle>
          <Link href="/dashboard/super-admin/schools/add">
            <Button size="sm">Add School</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {schools.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-dark-text-secondary">
              No schools found. Click &quot;Add School&quot; to create one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-dark-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-dark-text-secondary">
                    School Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-dark-text-secondary">
                    Location
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-dark-text-secondary">
                    Students
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-dark-text-secondary">
                    Teachers
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-dark-text-secondary">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-dark-text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school, index) => (
                <motion.tr
                  key={school.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/super-admin/schools/${school.id}`)}
                >
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-dark-text-primary">
                        {school.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-dark-text-muted">
                        {school.subdomain}.agora.com
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600 dark:text-dark-text-secondary">
                    {school.city}, {school.state}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-900 dark:text-dark-text-primary font-medium">
                    {school.students ?? 'N/A'}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-900 dark:text-dark-text-primary font-medium">
                    {school.teachers}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        school.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {school.status}
                    </span>
                  </td>
                  <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => router.push(`/dashboard/super-admin/schools/${school.id}/edit`)}
                      >
                        Edit
                      </Button>
                    </div>
                  </td>
                </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

