'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  useGetMySchoolQuery,
  useUpdateMySchoolMutation,
  useRequestEditTokenMutation,
  useVerifyEditTokenQuery,
} from '@/lib/store/api/schoolAdminApi';
import type { School } from '@/lib/store/api/schoolsApi';
import { Save, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function SchoolProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const { data: schoolData, isLoading: isLoadingSchool } = useGetMySchoolQuery();
  const school = schoolData?.data;

  const [updateSchool, { isLoading: isUpdating }] = useUpdateMySchoolMutation();
  const [requestToken, { isLoading: isRequestingToken }] = useRequestEditTokenMutation();

  // Verify token if present in URL
  const { data: tokenData, isLoading: isLoadingToken } = useVerifyEditTokenQuery(token || '', {
    skip: !token,
  });

  const [formData, setFormData] = useState<Partial<School>>({
    name: '',
    address: '',
    city: '',
    state: '',
    country: 'Nigeria',
    phone: '',
    email: '',
  } as Partial<School>);

  const [schoolLevels, setSchoolLevels] = useState({
    primary: false,
    secondary: false,
    tertiary: false,
  });

  const [hasTokenVerification, setHasTokenVerification] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // Initialize form data from school
  useEffect(() => {
    if (school) {
      setFormData({
        name: school.name || '',
        address: school.address || '',
        city: school.city || '',
        state: school.state || '',
        country: school.country || 'Nigeria',
        phone: school.phone || '',
        email: school.email || '',
      });
      setSchoolLevels({
        primary: school.hasPrimary || false,
        secondary: school.hasSecondary || false,
        tertiary: school.hasTertiary || false,
      });
    }
  }, [school]);

  // Handle token verification from URL
  useEffect(() => {
    if (token && tokenData?.data) {
      setHasTokenVerification(true);
      setVerificationToken(token);
      // Pre-fill form with verified changes
      const verifiedChanges = tokenData.data.changes as any;
      if (verifiedChanges.name) setFormData((prev) => ({ ...prev, name: verifiedChanges.name }));
      if (verifiedChanges.address) setFormData((prev) => ({ ...prev, address: verifiedChanges.address }));
      if (verifiedChanges.city) setFormData((prev) => ({ ...prev, city: verifiedChanges.city }));
      if (verifiedChanges.state) setFormData((prev) => ({ ...prev, state: verifiedChanges.state }));
      if (verifiedChanges.phone) setFormData((prev) => ({ ...prev, phone: verifiedChanges.phone }));
      if (verifiedChanges.email) setFormData((prev) => ({ ...prev, email: verifiedChanges.email }));
      if (verifiedChanges.levels && typeof verifiedChanges.levels === 'object') {
        const levels = verifiedChanges.levels;
        setSchoolLevels({
          primary: levels.primary ?? false,
          secondary: levels.secondary ?? false,
          tertiary: levels.tertiary ?? false,
        });
      }
      toast.success('Verification token verified. You can now apply the changes.');
    }
  }, [token, tokenData]);

  const handleInputChange = (field: keyof School, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLevelChange = (level: 'primary' | 'secondary' | 'tertiary', checked: boolean) => {
    setSchoolLevels((prev) => ({ ...prev, [level]: checked }));
  };

  const checkForSensitiveChanges = (): boolean => {
    if (!school) return false;
    return (
      (schoolLevels.primary !== school.hasPrimary) ||
      (schoolLevels.secondary !== school.hasSecondary) ||
      (schoolLevels.tertiary !== school.hasTertiary)
    );
  };

  const handleRequestToken = async () => {
    if (!school) return;

    const changes: any = {
      ...formData,
      levels: {
        primary: schoolLevels.primary,
        secondary: schoolLevels.secondary,
        tertiary: schoolLevels.tertiary,
      },
    };

    try {
      const result = await requestToken(changes).unwrap();
      toast.success(result.message || 'Verification email sent! Please check your email.');
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to request verification token');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;

    const changes: any = {
      ...formData,
      levels: {
        primary: schoolLevels.primary,
        secondary: schoolLevels.secondary,
        tertiary: schoolLevels.tertiary,
      },
    };

    const hasSensitiveChanges = checkForSensitiveChanges();

    // If sensitive changes and no token, request token first
    if (hasSensitiveChanges && !hasTokenVerification) {
      toast.error('School type changes require email verification. Please request a verification token first.');
      return;
    }

    try {
      await updateSchool({
        data: changes,
        token: hasTokenVerification ? verificationToken || undefined : undefined,
      }).unwrap();
      toast.success('School profile updated successfully!');
      // Clear token from URL if present
      if (token) {
        router.replace('/dashboard/school/settings/profile');
      }
      setHasTokenVerification(false);
      setVerificationToken(null);
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update school profile');
    }
  };

  if (isLoadingSchool) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!school) {
    return (
      <ProtectedRoute roles={['SCHOOL_ADMIN']}>
        <div className="flex items-center justify-center min-h-screen">
          <Alert variant="error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>School not found</AlertDescription>
          </Alert>
        </div>
      </ProtectedRoute>
    );
  }

  const hasSensitiveChanges = checkForSensitiveChanges();

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full max-w-4xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            School Profile Settings
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Update your school information. Changes to school type require email verification.
          </p>
        </motion.div>

        {hasTokenVerification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-400">
                Verification token verified. You can now apply your changes.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {hasSensitiveChanges && !hasTokenVerification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-800 dark:text-orange-400">
                You are changing the school type. This requires email verification. Click "Request Verification" to receive a verification token via email.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>School Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="name">School Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                    disabled={isUpdating}
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={isUpdating}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={isUpdating}
                  />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    disabled={isUpdating}
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state || ''}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    disabled={isUpdating}
                  />
                </div>

                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    disabled={isUpdating}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                    value={formData.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  disabled={isUpdating}
                />
              </div>

              <div className="border-t pt-6">
                <Label className="text-lg font-semibold mb-4 block">School Levels</Label>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                  Select the educational levels your school offers. Changes to school levels require email verification.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="primary"
                      checked={schoolLevels.primary}
                      onCheckedChange={(checked) => handleLevelChange('primary', checked === true)}
                      disabled={isUpdating}
                    />
                    <Label htmlFor="primary" className="cursor-pointer">
                      Primary School
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="secondary"
                      checked={schoolLevels.secondary}
                      onCheckedChange={(checked) => handleLevelChange('secondary', checked === true)}
                      disabled={isUpdating}
                    />
                    <Label htmlFor="secondary" className="cursor-pointer">
                      Secondary School
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tertiary"
                      checked={schoolLevels.tertiary}
                      onCheckedChange={(checked) => handleLevelChange('tertiary', checked === true)}
                      disabled={isUpdating}
                    />
                    <Label htmlFor="tertiary" className="cursor-pointer">
                      Tertiary/University
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                {hasSensitiveChanges && !hasTokenVerification && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRequestToken}
                    disabled={isRequestingToken}
                    className="flex items-center gap-2"
                  >
                    {isRequestingToken ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Request Verification
                      </>
                    )}
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isUpdating || (hasSensitiveChanges && !hasTokenVerification)}
                  className="flex items-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}

