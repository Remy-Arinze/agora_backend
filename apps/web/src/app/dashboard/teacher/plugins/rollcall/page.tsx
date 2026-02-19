'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { Smartphone, QrCode, Users, CheckCircle2, XCircle, Clock } from 'lucide-react';

// Mock data
const mockAttendance = [
  {
    id: '1',
    studentName: 'John Doe',
    admissionNumber: 'ADM001',
    status: 'present' as const,
    time: '8:15 AM',
  },
  {
    id: '2',
    studentName: 'Jane Smith',
    admissionNumber: 'ADM002',
    status: 'present' as const,
    time: '8:16 AM',
  },
  {
    id: '3',
    studentName: 'Michael Johnson',
    admissionNumber: 'ADM003',
    status: 'absent' as const,
    time: null,
  },
];

export default function RollCallPage() {
  const [attendance, setAttendance] = useState(mockAttendance);
  const [scanCode, setScanCode] = useState('');

  const handleScan = () => {
    // TODO: Process QR code scan
    console.log('Scanning:', scanCode);
  };

  const toggleAttendance = (id: string) => {
    setAttendance((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'present' ? 'absent' : 'present',
              time: item.status === 'present' ? null : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            }
          : item
      )
    );
  };

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;

  return (
    <ProtectedRoute roles={['TEACHER']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Smartphone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary">
                RollCall
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                Attendance tracking system
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* QR Code Scanner */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Scan Student ID
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-8 bg-gray-50 dark:bg-dark-surface rounded-lg text-center border-2 border-dashed border-light-border dark:border-dark-border">
                  <QrCode className="h-16 w-16 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    Scan QR code from student ID card
                  </p>
                  <Input
                    placeholder="Or enter student code manually"
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    className="mb-4"
                  />
                  <Button variant="primary" onClick={handleScan}>
                    Scan / Mark Attendance
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                Today&apos;s Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-800 dark:text-green-300">Present</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-400">{presentCount}</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-800 dark:text-red-300">Absent</p>
                      <p className="text-2xl font-bold text-red-900 dark:text-red-400">{absentCount}</p>
                    </div>
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Total</p>
                      <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{attendance.length}</p>
                    </div>
                    <Users className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance List */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
              Attendance List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attendance.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-surface rounded-lg"
                >
                  <div>
                    <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                      {item.studentName}
                    </p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      {item.admissionNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.time && (
                      <div className="flex items-center gap-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        <Clock className="h-3 w-3" />
                        {item.time}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAttendance(item.id)}
                      className={item.status === 'present' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                    >
                      {item.status === 'present' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
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

