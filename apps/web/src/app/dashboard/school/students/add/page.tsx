'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { UserPlus, Loader2 } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { 
  useGetMySchoolQuery, 
  useAdmitStudentMutation, 
  useGetClassesQuery,
  useGetClassArmsQuery,
  useGetClassLevelsQuery,
  useGenerateDefaultClassesMutation,
} from '@/lib/store/api/schoolAdminApi';
import { studentAdmissionFormSchema } from '@/lib/validations/school-forms';
import { useSchoolType } from '@/hooks/useSchoolType';
import { z } from 'zod';
import toast from 'react-hot-toast';

export default function AddStudentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Get school data
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;
  const { currentType } = useSchoolType();

  // Get classes for the current school type
  const { 
    data: classesResponse, 
    isLoading: isLoadingClasses,
    isFetching: isFetchingClasses 
  } = useGetClassesQuery(
    { schoolId: schoolId!, type: currentType || undefined },
    { skip: !schoolId }
  );
  const classes = classesResponse?.data || [];
  const hasClasses = classes.length > 0;
  const classesLoaded = !isLoadingClasses && !isFetchingClasses;

  // Get ClassArms for PRIMARY/SECONDARY schools
  const isPrimaryOrSecondary = currentType === 'PRIMARY' || currentType === 'SECONDARY';
  const { 
    data: classArmsResponse,
    isLoading: isLoadingClassArms,
    isFetching: isFetchingClassArms 
  } = useGetClassArmsQuery(
    { schoolId: schoolId!, schoolType: currentType || undefined },
    { skip: !schoolId || !isPrimaryOrSecondary }
  );
  const classArms = classArmsResponse?.data || [];
  const hasClassArms = classArms.length > 0;
  const classArmsLoaded = !isLoadingClassArms && !isFetchingClassArms;
  const schoolUsesClassArms = classArms.length > 0;

  // Get ClassLevels for grouping ClassArms
  const { 
    data: classLevelsResponse,
    isLoading: isLoadingClassLevels,
    isFetching: isFetchingClassLevels 
  } = useGetClassLevelsQuery(
    { schoolId: schoolId! },
    { skip: !schoolId || !isPrimaryOrSecondary }
  );
  const classLevels = classLevelsResponse?.data || [];
  const hasClassLevels = classLevels.length > 0;
  const classLevelsLoaded = !isLoadingClassLevels && !isFetchingClassLevels;

  // Group ClassArms by ClassLevel
  const classArmsByLevel = classLevels.reduce((acc, level) => {
    acc[level.id] = classArms.filter(arm => arm.classLevelId === level.id);
    return acc;
  }, {} as Record<string, typeof classArms>);

  // Student admission mutation
  const [admitStudent] = useAdmitStudentMutation();
  
  // Generate default classes mutation
  const [generateDefaultClasses, { isLoading: isGeneratingClasses }] = useGenerateDefaultClassesMutation();

  // Handler for generating classes
  const handleGenerateClasses = async () => {
    if (!schoolId || !currentType) return;
    
    try {
      await generateDefaultClasses({
        schoolId,
        schoolType: currentType,
      }).unwrap();
      toast.success('Default classes generated successfully!');
      // The query will automatically refetch due to cache invalidation
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to generate classes');
    }
  };

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    address: '',
    classLevel: '',
    classArmId: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    parentRelationship: '',
    bloodGroup: '',
    allergies: '',
    medications: '',
    emergencyContact: '',
    emergencyContactPhone: '',
    medicalNotes: '',
  });

  // Validate and sanitize form using Zod
  const validateForm = (): { isValid: boolean; sanitizedData?: z.infer<typeof studentAdmissionFormSchema> } => {
    const result = studentAdmissionFormSchema.safeParse(formData);
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      const errorMessages: string[] = [];
      
      result.error.issues.forEach((err) => {
        const fieldName = err.path[0] as string;
        fieldErrors[fieldName] = err.message;
        errorMessages.push(err.message);
      });
      
      setErrors(fieldErrors);
      
      // Show toast with errors
      if (errorMessages.length === 1) {
        toast.error(errorMessages[0]);
      } else if (errorMessages.length > 1) {
        toast.error(`Please fix ${errorMessages.length} errors in the form`, {
          duration: 4000,
        });
        setSubmitError(errorMessages[0]);
      } else {
        toast.error('Please check the form for errors');
      }
      
      return { isValid: false };
    }
    
    setErrors({});
    return { isValid: true, sanitizedData: result.data };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const validation = validateForm();
    if (!validation.isValid || !validation.sanitizedData) {
      return;
    }

    if (!schoolId) {
      setSubmitError('Unable to determine school. Please try refreshing the page.');
      toast.error('Unable to determine school. Please try refreshing the page.');
      return;
    }

    setIsLoading(true);

    try {
      // Use sanitized data from Zod validation
      const sanitized = validation.sanitizedData;
      const studentData = {
        firstName: sanitized.firstName,
        middleName: sanitized.middleName,
        lastName: sanitized.lastName,
        dateOfBirth: sanitized.dateOfBirth,
        email: sanitized.email,
        phone: sanitized.phone,
        address: sanitized.address,
        classLevel: sanitized.classArmId ? undefined : sanitized.classLevel, // Only send if no ClassArm
        classArmId: sanitized.classArmId,
        academicYear: sanitized.academicYear, // Will be auto-determined by backend if undefined
        parentName: sanitized.parentName,
        parentPhone: sanitized.parentPhone,
        parentEmail: sanitized.parentEmail,
        parentRelationship: sanitized.parentRelationship,
        bloodGroup: sanitized.bloodGroup,
        allergies: sanitized.allergies,
        medications: sanitized.medications,
        emergencyContact: sanitized.emergencyContact,
        emergencyContactPhone: sanitized.emergencyContactPhone,
        medicalNotes: sanitized.medicalNotes,
      };

      const result = await admitStudent({
        schoolId,
        student: studentData,
      }).unwrap();

      toast.success(result.message || 'Student admitted successfully!');
      router.push('/dashboard/school/students');
    } catch (error: any) {
      setIsLoading(false);
      
      // Handle validation errors from backend (array format)
      if (error?.data && Array.isArray(error.data)) {
        const fieldErrors: Record<string, string> = {};
        const errorMessages: string[] = [];
        
        // Field name mapping for user-friendly messages
        const fieldLabels: Record<string, string> = {
          parentPhone: 'Parent/Guardian Phone',
          parentEmail: 'Parent/Guardian Email',
          phone: 'Phone Number',
          email: 'Email Address',
          firstName: 'First Name',
          lastName: 'Last Name',
          dateOfBirth: 'Date of Birth',
          classLevel: 'Class Level',
          parentName: 'Parent/Guardian Name',
          parentRelationship: 'Relationship',
          emergencyContact: 'Emergency Contact',
          emergencyContactPhone: 'Emergency Contact Phone',
        };
        
        error.data.forEach((err: any) => {
          const fieldName = err.path?.[0] || 'unknown';
          const fieldLabel = fieldLabels[fieldName] || fieldName;
          let userMessage = err.message || 'Invalid value';
          
          // Convert technical messages to user-friendly ones
          if (err.code === 'too_small') {
            if (err.minimum) {
              userMessage = `${fieldLabel} must be at least ${err.minimum} characters`;
            } else {
              userMessage = `${fieldLabel} is too short`;
            }
          } else if (err.code === 'invalid_format' || err.code === 'invalid_string') {
            if (fieldName.includes('email')) {
              userMessage = `${fieldLabel} must be a valid email address`;
            } else if (fieldName.includes('phone')) {
              userMessage = `${fieldLabel} must be a valid phone number`;
            } else {
              userMessage = `${fieldLabel} format is invalid`;
            }
          } else if (err.code === 'too_big') {
            userMessage = `${fieldLabel} is too long`;
          } else if (err.code === 'invalid_type') {
            userMessage = `${fieldLabel} has an invalid value`;
          }
          
          fieldErrors[fieldName] = userMessage;
          errorMessages.push(userMessage);
        });
        
        setErrors(fieldErrors);
        
        // Show toast with first error or summary
        if (errorMessages.length === 1) {
          toast.error(errorMessages[0]);
        } else if (errorMessages.length > 1) {
          toast.error(`Please fix ${errorMessages.length} errors in the form`, {
            duration: 4000,
          });
          setSubmitError(errorMessages[0]);
        } else {
          toast.error('Please check the form for errors');
        }
        return;
      }
      
      // Handle other error formats
      const errorMessage = error?.data?.message || error?.message || 'Failed to admit student. Please try again.';
      setSubmitError(errorMessage);
      
      // Check if it's a conflict error (student already exists)
      if (error?.status === 409 || errorMessage.includes('already exists') || errorMessage.includes('transfer')) {
        toast.error(errorMessage, { duration: 6000 });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <BackButton fallbackUrl="/dashboard/school/students" className="mb-4" />
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Add New Student
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Register a new student in your school
          </p>
        </motion.div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submitError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {submitError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name *"
                    name="firstName"
                    value={formData.firstName}
                    onChange={(e) => {
                      setFormData({ ...formData, firstName: e.target.value });
                      if (errors.firstName) setErrors({ ...errors, firstName: '' });
                    }}
                    error={errors.firstName}
                    required
                  />
                  <Input
                    label="Middle Name"
                    name="middleName"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                  />
                  <Input
                    label="Last Name *"
                    name="lastName"
                    value={formData.lastName}
                    onChange={(e) => {
                      setFormData({ ...formData, lastName: e.target.value });
                      if (errors.lastName) setErrors({ ...errors, lastName: '' });
                    }}
                    error={errors.lastName}
                    required
                  />
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (errors.email) setErrors({ ...errors, email: '' });
                    }}
                    error={errors.email}
                  />
                  <Input
                    label="Phone *"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (errors.phone) setErrors({ ...errors, phone: '' });
                    }}
                    error={errors.phone}
                    required
                  />
                  <Input
                    label="Date of Birth *"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => {
                      setFormData({ ...formData, dateOfBirth: e.target.value });
                      if (errors.dateOfBirth) setErrors({ ...errors, dateOfBirth: '' });
                    }}
                    error={errors.dateOfBirth}
                    required
                  />
                  <Input
                    label="Address"
                    name="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              {/* Academic Information */}
              <div>
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                  Academic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schoolUsesClassArms && isPrimaryOrSecondary ? (
                    // ClassArm selector for PRIMARY/SECONDARY schools using ClassArms
                    <div>
                      <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                        ClassArm *
                      </label>
                      {isLoadingClassArms || isFetchingClassArms || isLoadingClassLevels || isFetchingClassLevels ? (
                        <div className="w-full px-4 py-2 border border-light-border dark:border-dark-border rounded-lg bg-light-card dark:bg-dark-surface">
                          <div className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading class arms...</span>
                          </div>
                        </div>
                      ) : !hasClassArms && classArmsLoaded && !hasClassLevels && classLevelsLoaded ? (
                        <div className="space-y-2">
                          <div className="w-full px-4 py-3 border border-yellow-500/50 dark:border-yellow-500/30 rounded-lg bg-yellow-50/10 dark:bg-yellow-900/10">
                            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-2">
                              No class arms found. You need to create classes first.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {currentType && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={handleGenerateClasses}
                                  isLoading={isGeneratingClasses}
                                >
                                  Generate Default Classes
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <select
                          name="classArmId"
                          value={formData.classArmId}
                          onChange={(e) => {
                            const selectedArmId = e.target.value;
                            const selectedArm = classArms.find(arm => arm.id === selectedArmId);
                            setFormData({ 
                              ...formData, 
                              classArmId: selectedArmId,
                              classLevel: selectedArm ? selectedArm.classLevelName : '', // Auto-populate classLevel
                            });
                            if (errors.classArmId) setErrors({ ...errors, classArmId: '' });
                          }}
                          className={`w-full px-4 py-2 border rounded-lg bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                            errors.classArmId
                              ? 'border-red-500 dark:border-red-500'
                              : 'border-light-border dark:border-dark-border'
                          }`}
                          required
                        >
                          <option value="">Select ClassArm</option>
                          {classLevels.map((level) => {
                            const armsForLevel = classArmsByLevel[level.id] || [];
                            if (armsForLevel.length === 0) return null;
                            return (
                              <optgroup key={level.id} label={level.name}>
                                {armsForLevel.map((arm) => (
                                  <option key={arm.id} value={arm.id}>
                                    {level.name} {arm.name}
                                    {arm.capacity && ` (${arm.capacity} max)`}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      )}
                      {errors.classArmId && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.classArmId}</p>
                      )}
                      {!isLoadingClassArms && !isFetchingClassArms && hasClassArms && (
                        <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          Select the specific ClassArm (e.g., JSS 1 Gold, JSS 1 Blue)
                        </p>
                      )}
                    </div>
                  ) : (
                    // Class selector for TERTIARY or schools without ClassArms (backward compatibility)
                    <div>
                      <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                        Class Level *
                      </label>
                      {isLoadingClasses || isFetchingClasses ? (
                        <div className="w-full px-4 py-2 border border-light-border dark:border-dark-border rounded-lg bg-light-card dark:bg-dark-surface">
                          <div className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading classes...</span>
                          </div>
                        </div>
                      ) : !hasClasses && classesLoaded ? (
                        <div className="space-y-2">
                          <div className="w-full px-4 py-3 border border-yellow-500/50 dark:border-yellow-500/30 rounded-lg bg-yellow-50/10 dark:bg-yellow-900/10">
                            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-2">
                              No classes found. You need to create classes before adding students.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {currentType && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={handleGenerateClasses}
                                  isLoading={isGeneratingClasses}
                                >
                                  Generate Default Classes
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <select
                          name="classLevel"
                          value={formData.classLevel}
                          onChange={(e) => {
                            setFormData({ ...formData, classLevel: e.target.value });
                            if (errors.classLevel) setErrors({ ...errors, classLevel: '' });
                          }}
                          className={`w-full px-4 py-2 border rounded-lg bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                            errors.classLevel
                              ? 'border-red-500 dark:border-red-500'
                              : 'border-light-border dark:border-dark-border'
                          }`}
                          required
                        >
                          <option value="">Select class level</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.name}>
                              {cls.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {errors.classLevel && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.classLevel}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Parent/Guardian Information */}
              <div>
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                  Parent/Guardian Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Parent Name *"
                    name="parentName"
                    value={formData.parentName}
                    onChange={(e) => {
                      setFormData({ ...formData, parentName: e.target.value });
                      if (errors.parentName) setErrors({ ...errors, parentName: '' });
                    }}
                    error={errors.parentName}
                    required
                  />
                  <Input
                    label="Parent Phone *"
                    name="parentPhone"
                    type="tel"
                    value={formData.parentPhone}
                    onChange={(e) => {
                      setFormData({ ...formData, parentPhone: e.target.value });
                      if (errors.parentPhone) setErrors({ ...errors, parentPhone: '' });
                    }}
                    error={errors.parentPhone}
                    required
                  />
                  <Input
                    label="Parent Email"
                    name="parentEmail"
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => {
                      setFormData({ ...formData, parentEmail: e.target.value });
                      if (errors.parentEmail) setErrors({ ...errors, parentEmail: '' });
                    }}
                    error={errors.parentEmail}
                  />
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Relationship *
                    </label>
                    <select
                      name="parentRelationship"
                      value={formData.parentRelationship}
                      onChange={(e) => {
                        setFormData({ ...formData, parentRelationship: e.target.value });
                        if (errors.parentRelationship) setErrors({ ...errors, parentRelationship: '' });
                      }}
                      className={`w-full px-4 py-2 border rounded-lg bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                        errors.parentRelationship
                          ? 'border-red-500 dark:border-red-500'
                          : 'border-light-border dark:border-dark-border'
                      }`}
                      required
                    >
                      <option value="">Select relationship</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.parentRelationship && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.parentRelationship}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Health Information */}
              <div>
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                  Health Information (Optional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Blood Group"
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  />
                  <Input
                    label="Allergies"
                    name="allergies"
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  />
                  <Input
                    label="Medications"
                    name="medications"
                    value={formData.medications}
                    onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                  />
                  <Input
                    label="Emergency Contact Name"
                    name="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  />
                  <Input
                    label="Emergency Contact Phone"
                    name="emergencyContactPhone"
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => {
                      setFormData({ ...formData, emergencyContactPhone: e.target.value });
                      if (errors.emergencyContactPhone) setErrors({ ...errors, emergencyContactPhone: '' });
                    }}
                    error={errors.emergencyContactPhone}
                    placeholder="Must be at least 10 characters if provided"
                  />
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Medical Notes
                    </label>
                    <textarea
                      name="medicalNotes"
                      value={formData.medicalNotes}
                      onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-light-border dark:border-dark-border rounded-lg bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-light-border dark:border-dark-border">
                <Link href="/dashboard/school/students">
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" isLoading={isLoading}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Student
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
