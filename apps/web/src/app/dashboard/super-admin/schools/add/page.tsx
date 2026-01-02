'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, UserPlus, X, User, GraduationCap } from 'lucide-react';
import { useCreateSchool, useUpdateSchool, useSchool } from '@/hooks/useSchools';

type AdminRole = 'PRINCIPAL' | 'BURSAR' | 'GUIDANCE_COUNSELOR' | 'VICE_PRINCIPAL' | 'ADMINISTRATOR';

interface AdminForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: AdminRole;
}

export default function AddSchoolPage() {
  const router = useRouter();
  const params = useParams();
  
  // Extract schoolId from params - this should be the database ID, not subdomain
  const schoolId = params?.id as string | undefined;
  const isEditMode = !!schoolId;

  const { createSchool, isLoading: isCreating } = useCreateSchool();
  const { updateSchool, isLoading: isUpdating } = useUpdateSchool();
  const { school, isLoading: isLoadingSchool } = useSchool(isEditMode ? schoolId : null);
  
  // Debug log to verify params
  useEffect(() => {
    if (isEditMode && typeof window !== 'undefined') {
      console.log('AddSchoolPage - Edit mode detected');
      console.log('URL param (schoolId):', schoolId);
      console.log('School data loaded:', school ? 'Yes' : 'No');
      if (school) {
        console.log('School database ID:', school.id);
        console.log('School subdomain:', school.subdomain);
      }
    }
  }, [isEditMode, schoolId, school]);

  const isSubmitting = isCreating || isUpdating;
  const [formData, setFormData] = useState({
    // School Info
    name: '',
    subdomain: '',
    address: '',
    city: '',
    state: '',
    country: 'Nigeria',
    phone: '',
    email: '',
  });

  const [schoolLevels, setSchoolLevels] = useState({
    primary: false,
    secondary: false,
    tertiary: false,
  });
  
  const [principal, setPrincipal] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const [admins, setAdmins] = useState<AdminForm[]>([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState<AdminForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'ADMINISTRATOR',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePrincipalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPrincipal((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewAdminChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAdmin((prev) => ({ ...prev, [name]: value }));
  };

  const addAdmin = () => {
    if (!newAdmin.firstName || !newAdmin.lastName || !newAdmin.email || !newAdmin.phone) {
      toast.error('Please fill in all admin fields');
      return;
    }

    // Check if email already exists in admins or principal
    if (admins.some(a => a.email === newAdmin.email) || principal.email === newAdmin.email) {
      toast.error('This email is already added');
      return;
    }

    setAdmins([...admins, newAdmin]);
    setNewAdmin({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'ADMINISTRATOR',
    });
    setShowAddAdmin(false);
    toast.success('Admin added');
  };

  const removeAdmin = (index: number) => {
    setAdmins(admins.filter((_, i) => i !== index));
    toast.success('Admin removed');
  };

  // Populate form when editing
  useEffect(() => {
    if (isEditMode && school) {
      setFormData({
        name: school.name || '',
        subdomain: school.subdomain || '',
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
  }, [isEditMode, school]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate required fields
      if (!formData.name || !formData.subdomain || !formData.address || !formData.city || !formData.state) {
        toast.error('Please fill in all required school fields');
        return;
      }

      // Validate school levels
      if (!schoolLevels.primary && !schoolLevels.secondary && !schoolLevels.tertiary) {
        toast.error('Please select at least one school level');
        return;
      }

      // Prepare request body
      const requestBody: any = {
        name: formData.name,
        subdomain: formData.subdomain.toLowerCase().replace(/\s+/g, '-'),
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country || 'Nigeria',
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        levels: {
          primary: schoolLevels.primary,
          secondary: schoolLevels.secondary,
          tertiary: schoolLevels.tertiary,
        },
      };

      if (isEditMode) {
        // Update school - don't include principal/admins in update
        // CRITICAL: Always use school.id from fetched data, never the URL param
        // The URL param might be a subdomain, but we need the database ID
        if (!school?.id) {
          toast.error('School data not loaded. Please wait and try again.');
          return;
        }
        console.log('Updating school with ID:', school.id, 'URL param was:', schoolId);
        await updateSchool(school.id, requestBody);
      } else {
        // Create school - include principal/admins
        // Add principal if provided
        if (principal.firstName && principal.lastName && principal.email && principal.phone) {
          requestBody.principal = {
            firstName: principal.firstName,
            lastName: principal.lastName,
            email: principal.email,
            phone: principal.phone,
          };
        }

        // Add admins if provided
        if (admins.length > 0) {
          requestBody.admins = admins.map(admin => ({
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
            phone: admin.phone,
            role: admin.role,
          }));
        }

        // Use the hook - it handles navigation and toast notifications
        await createSchool(requestBody);
      }
    } catch (err) {
      // Error is already handled in the hook
    }
  };

  if (isEditMode && isLoadingSchool) {
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  // If in edit mode but school data failed to load, show error
  if (isEditMode && !isLoadingSchool && !school) {
    return (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <div className="w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">
              Failed to load school data. The school ID might be invalid.
            </p>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              URL param: {schoolId}
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute roles={['SUPER_ADMIN']}>
      <div className="w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            {isEditMode ? 'Edit School' : 'Add New School'}
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            {isEditMode 
              ? 'Update school information and institution levels'
              : 'Create a new school and optionally assign a principal and administrators'
            }
          </p>
        </motion.div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* School Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    School Information
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      School Name *
                    </label>
                    <Input
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="Enter school name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      Subdomain *
                    </label>
                    <Input
                      name="subdomain"
                      value={formData.subdomain}
                      onChange={handleChange}
                      required
                      placeholder="schoolname"
                    />
                    <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                      {formData.subdomain || 'schoolname'}.agora.com
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      Address *
                    </label>
                    <Input
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      required
                      placeholder="Enter school address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      City *
                    </label>
                    <Input
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      State *
                    </label>
                    <Input
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      placeholder="Enter state"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      Country
                    </label>
                    <Input
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      placeholder="Enter country"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      Phone
                    </label>
                    <Input
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+234 801 234 5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      Email
                    </label>
                    <Input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="info@school.com"
                    />
                  </div>
                </div>

                {/* School Levels */}
                <div className="mt-6 pt-6 border-t border-light-border dark:border-dark-border">
                  <div className="flex items-center gap-3 mb-4">
                    <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                      School Levels *
                    </label>
                  </div>
                  <p className="text-xs text-light-text-muted dark:text-dark-text-muted mb-4">
                    Select the educational levels this school offers. Some schools offer only primary, some offer primary and secondary, while others offer all three levels.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3 p-4 bg-light-bg dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <input
                        type="checkbox"
                        id="primary"
                        checked={schoolLevels.primary}
                        onChange={(e) => setSchoolLevels({ ...schoolLevels, primary: e.target.checked })}
                        className="mt-1 h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-light-border dark:border-dark-border rounded"
                      />
                      <div className="flex-1">
                        <label htmlFor="primary" className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer">
                          Primary
                        </label>
                        <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                          Nursery, Primary 1-6
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-light-bg dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <input
                        type="checkbox"
                        id="secondary"
                        checked={schoolLevels.secondary}
                        onChange={(e) => setSchoolLevels({ ...schoolLevels, secondary: e.target.checked })}
                        className="mt-1 h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-light-border dark:border-dark-border rounded"
                      />
                      <div className="flex-1">
                        <label htmlFor="secondary" className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer">
                          Secondary
                        </label>
                        <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                          JSS 1-3, SSS 1-3
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-light-bg dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <input
                        type="checkbox"
                        id="tertiary"
                        checked={schoolLevels.tertiary}
                        onChange={(e) => setSchoolLevels({ ...schoolLevels, tertiary: e.target.checked })}
                        className="mt-1 h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-light-border dark:border-dark-border rounded"
                      />
                      <div className="flex-1">
                        <label htmlFor="tertiary" className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer">
                          Tertiary
                        </label>
                        <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                          University, College, Polytechnic
                        </p>
                      </div>
                    </div>
                  </div>
                  {!schoolLevels.primary && !schoolLevels.secondary && !schoolLevels.tertiary && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      Please select at least one school level
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Principal Information - Only show when creating */}
            {!isEditMode && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    Principal Information (Optional)
                  </CardTitle>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                    You can add a principal now or add one later from the school detail page
                  </p>
                </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      First Name
                    </label>
                    <Input
                      name="firstName"
                      value={principal.firstName}
                      onChange={handlePrincipalChange}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      Last Name
                    </label>
                    <Input
                      name="lastName"
                      value={principal.lastName}
                      onChange={handlePrincipalChange}
                      placeholder="Enter last name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      Email
                    </label>
                    <Input
                      name="email"
                      type="email"
                      value={principal.email}
                      onChange={handlePrincipalChange}
                      placeholder="principal@school.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                      Phone
                    </label>
                    <Input
                      name="phone"
                      type="tel"
                      value={principal.phone}
                      onChange={handlePrincipalChange}
                      placeholder="+234 801 234 5678"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Additional Admins - Only show when creating */}
            {!isEditMode && (
              <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                      Additional Administrators (Optional)
                    </CardTitle>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                      Add administrators with specific roles (Bursar, Guidance Counselor, etc.)
                    </p>
                  </div>
                  {!showAddAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddAdmin(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Admin
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Existing Admins */}
                {admins.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {admins.map((admin, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-light-bg dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border"
                      >
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <div>
                            <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                              {admin.firstName} {admin.lastName}
                            </p>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              {admin.email} • {admin.role.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAdmin(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Admin Form */}
                {showAddAdmin && (
                  <div className="p-4 bg-light-bg dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                          First Name *
                        </label>
                        <Input
                          name="firstName"
                          value={newAdmin.firstName}
                          onChange={handleNewAdminChange}
                          placeholder="Enter first name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                          Last Name *
                        </label>
                        <Input
                          name="lastName"
                          value={newAdmin.lastName}
                          onChange={handleNewAdminChange}
                          placeholder="Enter last name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                          Email *
                        </label>
                        <Input
                          name="email"
                          type="email"
                          value={newAdmin.email}
                          onChange={handleNewAdminChange}
                          placeholder="admin@school.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                          Phone *
                        </label>
                        <Input
                          name="phone"
                          type="tel"
                          value={newAdmin.phone}
                          onChange={handleNewAdminChange}
                          placeholder="+234 801 234 5678"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                          Role *
                        </label>
                        <select
                          name="role"
                          value={newAdmin.role}
                          onChange={handleNewAdminChange}
                          className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-lg bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                        >
                          <option value="BURSAR">Bursar</option>
                          <option value="GUIDANCE_COUNSELOR">Guidance Counselor</option>
                          <option value="VICE_PRINCIPAL">Vice Principal</option>
                          <option value="ADMINISTRATOR">Administrator</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={addAdmin}
                      >
                        Add Admin
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowAddAdmin(false);
                          setNewAdmin({
                            firstName: '',
                            lastName: '',
                            email: '',
                            phone: '',
                            role: 'ADMINISTRATOR',
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {isEditMode ? 'Update School' : 'Create School'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
}
