'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { CopyToClipboard } from './CopyToClipboard';
import { SchoolStatsCard } from './SchoolStatsCard';
import { School } from '@/hooks/useSchools';
import { Building2, MapPin, GraduationCap, BookOpen, User, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useResendPasswordResetForStaffMutation } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';

interface SchoolDetailsCardProps {
  school: School;
  schoolId?: string;
}

export function SchoolDetailsCard({ school, schoolId }: SchoolDetailsCardProps) {
  const [resendEmail, { isLoading: isResending }] = useResendPasswordResetForStaffMutation();

  // Find school owner (admin with 'school_owner' role)
  const schoolOwner = school.admins?.find((admin) => {
    const roleLower = admin.role?.trim().toLowerCase() || '';
    return roleLower === 'school_owner';
  });

  const handleResendEmail = async () => {
    if (!schoolId || !schoolOwner || !schoolOwner.email) {
      toast.error('Unable to resend email');
      return;
    }

    try {
      await resendEmail({ schoolId, staffId: schoolOwner.id }).unwrap();
      toast.success(`Password setup email resent to ${schoolOwner.email}`);
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to resend email. Please try again.');
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
            School Details
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
              {school.name}
            </h3>
            <div className="space-y-2">
              {school.address && (
                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {school.address}
                    {school.city && `, ${school.city}`}
                    {school.state && `, ${school.state}`}
                  </span>
                </div>
              )}
              {school.schoolId && (
                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  <span className="font-medium">School ID:</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {school.schoolId}
                  </span>
                  <CopyToClipboard text={school.schoolId} id={`school-${school.id}`} size="sm" />
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span className="font-medium">Subdomain:</span>
                <span>{school.subdomain}.agora.com</span>
              </div>
              {school.domain && (
                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  <span className="font-medium">Domain:</span>
                  <span>{school.domain}</span>
                </div>
              )}
              {school.phone && (
                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  <span className="font-medium">Phone:</span>
                  <span>{school.phone}</span>
                </div>
              )}
              {school.email && (
                <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  <span className="font-medium">Email:</span>
                  <span>{school.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                <span className="font-medium">Country:</span>
                <span>{school.country}</span>
              </div>

              {/* School Owner Account */}
              {schoolOwner && (
                <div className="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                      School Owner Account
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      <span className="font-medium">Name:</span>
                      <span>
                        {schoolOwner.firstName} {schoolOwner.lastName}
                      </span>
                    </div>
                    {schoolOwner.email && (
                      <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        <span className="font-medium">Email:</span>
                        <span>{schoolOwner.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {schoolOwner.accountStatus === 'SHADOW' ? (
                        <>
                          <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                            Inactive - Password Not Set
                          </span>
                          {schoolId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleResendEmail}
                              disabled={isResending}
                              className="text-xs h-6 px-2"
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              {isResending ? 'Sending...' : 'Resend Email'}
                            </Button>
                          )}
                        </>
                      ) : schoolOwner.accountStatus === 'ACTIVE' ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-2">
                      The school contact email ({school.email}) has been set up as a School Owner account with full administrative access.
                    </p>
                  </div>
                </div>
              )}

              {/* Institution Type */}
              <div className="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                    Institution Type
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {school.hasPrimary && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium border border-blue-200 dark:border-blue-800">
                      <BookOpen className="h-3.5 w-3.5" />
                      Primary
                    </span>
                  )}
                  {school.hasSecondary && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium border border-green-200 dark:border-green-800">
                      <BookOpen className="h-3.5 w-3.5" />
                      Secondary
                    </span>
                  )}
                  {school.hasTertiary && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-medium border border-purple-200 dark:border-purple-800">
                      <GraduationCap className="h-3.5 w-3.5" />
                      Tertiary
                    </span>
                  )}
                  {!school.hasPrimary && !school.hasSecondary && !school.hasTertiary && (
                    <span className="text-sm text-light-text-muted dark:text-dark-text-muted italic">
                      No levels specified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="md:w-80 flex-shrink-0">
            <SchoolStatsCard school={school} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

