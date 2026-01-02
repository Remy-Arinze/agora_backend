'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';
import { motion } from 'framer-motion';
import { UserPlus, CheckCircle2, XCircle, Clock, Eye, Calendar, User, Phone, Mail, MapPin, Heart, AlertCircle, GraduationCap, Loader2 } from 'lucide-react';
import { useGetMySchoolQuery, useAdmitStudentMutation, useGetClassesQuery, useGetStudentsQuery, useUploadStudentImageMutation, type AddStudentDto, type Class, type StudentWithEnrollment } from '@/lib/store/api/schoolAdminApi';
import { studentAdmissionFormSchema } from '@/lib/validations/school-forms';
import { useSchoolType } from '@/hooks/useSchoolType';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ImageUpload } from '@/components/ui/ImageUpload';

// Student Avatar component for cards
const StudentAvatar = ({ 
  profileImage, 
  firstName, 
  lastName 
}: { 
  profileImage?: string | null; 
  firstName?: string; 
  lastName?: string; 
}) => {
  const [imageError, setImageError] = useState(false);
  
  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0]?.toUpperCase() || '';
    const last = lastName?.[0]?.toUpperCase() || '';
    return first + last || '?';
  };
  
  if (profileImage && !imageError) {
    return (
      <div className="relative w-10 h-10 flex-shrink-0">
        <img
          src={profileImage}
          alt={`${firstName} ${lastName}`}
          className="w-10 h-10 rounded-full object-cover border-2 border-light-border dark:border-dark-border shadow-sm"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }
  
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white font-semibold text-sm border-2 border-light-border dark:border-dark-border shadow-sm flex-shrink-0">
      {getInitials(firstName, lastName)}
    </div>
  );
};

function AdmissionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('All');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showNewApplicationForm, setShowNewApplicationForm] = useState(false);
  const [showTransferInfo, setShowTransferInfo] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const limit = 20;

  // Get school data
  const { data: schoolResponse } = useGetMySchoolQuery();
  const schoolId = schoolResponse?.data?.id;
  const { currentType } = useSchoolType();

  // Get classes for the current school type
  const { data: classesResponse } = useGetClassesQuery(
    { schoolId: schoolId!, type: currentType || undefined },
    { skip: !schoolId }
  );
  const classes = classesResponse?.data || [];

  // Get admitted students
  const { data: studentsResponse, isLoading: isLoadingStudents } = useGetStudentsQuery(
    { schoolId: schoolId!, page, limit, schoolType: currentType || undefined },
    { skip: !schoolId }
  );
  const students = studentsResponse?.data?.items || [];
  const pagination = studentsResponse?.data;

  // Student admission mutation
  const [admitStudent, { isLoading: isAdmitting }] = useAdmitStudentMutation();
  const [uploadStudentImage] = useUploadStudentImageMutation();
  
  // Image upload state
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // Helper function to capitalize first letter of each word (preserves spaces while typing)
  const capitalizeWords = (str: string): string => {
    if (!str) return str;
    // Use a regex to match word boundaries and capitalize first letter of each word
    // This preserves all spaces and characters
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Format name input on change (preserves spaces)
  const handleNameChange = (field: 'firstName' | 'lastName' | 'middleName' | 'parentName', value: string) => {
    // Only capitalize, don't trim - preserve spaces while typing
    const capitalized = capitalizeWords(value);
    setFormData({ ...formData, [field]: capitalized });
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    age: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
    classLevel: '',
    classArmId: '', // For ClassArm-based enrollment
    // Parent/Guardian Information
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    parentRelationship: '',
    // Health Information
    bloodGroup: '',
    allergies: '',
    medications: '',
    emergencyContact: '',
    emergencyContactPhone: '',
    medicalNotes: '',
  });

  useEffect(() => {
    const newParam = searchParams.get('new');
    const fromTransfer = searchParams.get('fromTransfer');
    if (newParam === 'true') {
      if (fromTransfer) {
        setTransferId(fromTransfer);
        setShowTransferInfo(true);
        // TODO: Fetch transfer student data and pre-fill form
      } else {
        setShowNewApplicationForm(true);
      }
    }
  }, [searchParams]);

  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return '';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  const handleDateOfBirthChange = (value: string) => {
    setFormData({ ...formData, dateOfBirth: value, age: calculateAge(value) });
    if (errors.dateOfBirth) {
      setErrors({ ...errors, dateOfBirth: undefined });
    }
  };

  const handleProceedFromTransfer = () => {
    setShowTransferInfo(false);
    setShowNewApplicationForm(true);
  };

  const validateForm = (): boolean => {
    setErrors({});
    setSubmitError(null);

    try {
      studentAdmissionFormSchema.parse({
        ...formData,
        email: formData.email || undefined,
        parentEmail: formData.parentEmail || undefined,
        middleName: formData.middleName || undefined,
        address: formData.address || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        allergies: formData.allergies || undefined,
        medications: formData.medications || undefined,
        emergencyContact: formData.emergencyContact || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        medicalNotes: formData.medicalNotes || undefined,
      });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError && error.errors && Array.isArray(error.errors)) {
        const fieldErrors: Record<string, string> = {};
        const errorMessages: string[] = [];
        
        error.errors.forEach((err) => {
          if (err.path && err.path.length > 0 && err.path[0]) {
            const fieldName = err.path[0] as string;
            fieldErrors[fieldName] = err.message;
            errorMessages.push(err.message);
          }
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
      } else {
        // Handle non-Zod errors
        const errorMessage = error instanceof Error ? error.message : 'Validation failed. Please check your input.';
        setSubmitError(errorMessage);
        toast.error(errorMessage);
      }
      return false;
    }
  };

  // Check if all required fields are filled (for button disable state)
  const isFormValid = (): boolean => {
    return !!(
      formData.firstName?.trim() &&
      formData.lastName?.trim() &&
      formData.dateOfBirth &&
      formData.gender &&
      formData.phone?.trim() &&
      formData.classLevel &&
      formData.parentName?.trim() &&
      formData.parentPhone?.trim() &&
      formData.parentRelationship?.trim()
    );
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    if (!validateForm()) {
      return;
    }

    if (!schoolId) {
      setSubmitError('Unable to determine school. Please try refreshing the page.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const studentData: AddStudentDto = {
        firstName: formData.firstName.trim(),
        middleName: formData.middleName?.trim() || undefined,
        lastName: formData.lastName.trim(),
        dateOfBirth: formData.dateOfBirth,
        email: formData.email?.trim() || undefined,
        phone: formData.phone.trim(),
        address: formData.address?.trim() || undefined,
        classLevel: formData.classArmId ? undefined : formData.classLevel, // Only send if no ClassArm
        classArmId: formData.classArmId || undefined, // Send ClassArm ID if available
        academicYear: undefined, // Will be auto-determined by backend
        parentName: formData.parentName.trim(),
        parentPhone: formData.parentPhone.trim(),
        parentEmail: formData.parentEmail?.trim() || undefined,
        parentRelationship: formData.parentRelationship.trim(),
        bloodGroup: formData.bloodGroup?.trim() || undefined,
        allergies: formData.allergies?.trim() || undefined,
        medications: formData.medications?.trim() || undefined,
        emergencyContact: formData.emergencyContact?.trim() || undefined,
        emergencyContactPhone: formData.emergencyContactPhone?.trim() || undefined,
        medicalNotes: formData.medicalNotes?.trim() || undefined,
      };

      const result = await admitStudent({
        schoolId,
        student: {
          ...studentData,
          profileImage: profileImage || undefined,
        },
      }).unwrap();

      // Upload image if a new file was selected
      if (selectedImageFile && result.id) {
        try {
          await uploadStudentImage({
            schoolId,
            studentId: result.id,
            file: selectedImageFile,
          }).unwrap();
          toast.success('Profile image uploaded successfully!');
        } catch (uploadError: any) {
          console.error('Failed to upload profile image:', uploadError);
          toast.error(uploadError?.data?.message || 'Failed to upload profile image.');
        }
      }

      toast.success(result.message || 'Student admitted successfully!');
      
      setShowNewApplicationForm(false);
      setTransferId(null);
      setSubmitError(null);
      setErrors({});
      setProfileImage(null);
      setSelectedImageFile(null);
      setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        age: '',
        gender: '',
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
      setProfileImage(null);
      setSelectedImageFile(null);
      router.push('/dashboard/school/admissions');
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
          // Show first error as main error
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

  // Filter students based on search, class, and timeframe
  const filteredAdmissions = useMemo(() => {
    let filtered = students.filter((student) => {
      // Search filter
      const matchesSearch = !searchQuery || 
        student.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.enrollment?.classLevel?.toLowerCase().includes(searchQuery.toLowerCase()));

      // Class filter
      const matchesClass = classFilter === 'All' || 
        student.enrollment?.classLevel === classFilter;

      // Timeframe filter
      let matchesTimeframe = true;
      if (timeframeFilter !== 'All' && student.enrollment?.enrollmentDate) {
        const enrollmentDate = new Date(student.enrollment.enrollmentDate);
        const now = new Date();
        
        switch (timeframeFilter) {
          case 'Today':
            matchesTimeframe = enrollmentDate.toDateString() === now.toDateString();
            break;
          case 'This Week':
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            matchesTimeframe = enrollmentDate >= weekAgo;
            break;
          case 'This Month':
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            matchesTimeframe = enrollmentDate >= monthAgo;
            break;
          case 'This Year':
            const yearStart = new Date(now.getFullYear(), 0, 1);
            matchesTimeframe = enrollmentDate >= yearStart;
            break;
          case 'Custom':
            if (startDate && endDate) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999); // Include entire end date
              matchesTimeframe = enrollmentDate >= start && enrollmentDate <= end;
            }
            break;
        }
      }

      return matchesSearch && matchesClass && matchesTimeframe;
    });

    // Sort by enrollment date (most recent first)
    return filtered.sort((a, b) => {
      const dateA = a.enrollment?.enrollmentDate ? new Date(a.enrollment.enrollmentDate).getTime() : 0;
      const dateB = b.enrollment?.enrollmentDate ? new Date(b.enrollment.enrollmentDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [students, searchQuery, classFilter, timeframeFilter, startDate, endDate]);

  return (
    <ProtectedRoute roles={['SCHOOL_ADMIN']}>
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
                Admissions
              </h1>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">
                View and manage admitted students
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowNewApplicationForm(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              New Application
            </Button>
          </div>
        </motion.div>

        {/* Admissions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                Admitted Students ({filteredAdmissions.length})
              </CardTitle>
              <div className="flex items-center gap-3 flex-1 justify-end">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by name, ID, or class..."
                  containerClassName="w-64"
                  size="md"
                />
                {/* Filters */}
                <div className="w-36">
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-light-border dark:border-dark-border rounded-lg bg-light-bg dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 h-9"
                  >
                    <option value="All">All Classes</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.name}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-36">
                  <select
                    value={timeframeFilter}
                    onChange={(e) => {
                      setTimeframeFilter(e.target.value);
                      if (e.target.value !== 'Custom') {
                        setStartDate('');
                        setEndDate('');
                      }
                    }}
                    className="w-full px-2 py-2 text-sm border border-light-border dark:border-dark-border rounded-lg bg-light-bg dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 h-9"
                  >
                    <option value="All">All Time</option>
                    <option value="Today">Today</option>
                    <option value="This Week">This Week</option>
                    <option value="This Month">This Month</option>
                    <option value="This Year">This Year</option>
                    <option value="Custom">Custom Range</option>
                  </select>
                </div>
                {timeframeFilter === 'Custom' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-40 text-sm h-9"
                      placeholder="Start Date"
                    />
                    <span className="text-light-text-muted dark:text-dark-text-muted text-sm">to</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-40 text-sm h-9"
                      placeholder="End Date"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingStudents ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-light-text-muted dark:text-dark-text-muted mx-auto mb-2" />
                <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading students...</p>
              </div>
            ) : filteredAdmissions.length === 0 ? (
              <div className="text-center py-12">
                <GraduationCap className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  No admitted students found.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-light-border dark:border-dark-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                        Applicant
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                        School
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                        Class Level
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                        Admission Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingStudents ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <Loader2 className="h-8 w-8 animate-spin text-light-text-muted dark:text-dark-text-muted mx-auto mb-2" />
                          <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading students...</p>
                        </td>
                      </tr>
                    ) : filteredAdmissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <GraduationCap className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
                          <p className="text-light-text-secondary dark:text-dark-text-secondary">
                            No admitted students found.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredAdmissions.map((student, index) => (
                        <motion.tr
                          key={student.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-light-border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-[var(--dark-hover)] transition-colors cursor-pointer"
                          onClick={() => router.push(`/dashboard/school/students/${student.id}`)}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <StudentAvatar
                                profileImage={student.profileImage || null}
                                firstName={student.firstName}
                                lastName={student.lastName}
                              />
                              <div>
                                <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                  {student.firstName} {student.middleName ? `${student.middleName} ` : ''}{student.lastName}
                                </p>
                                <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                  {student.uid}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {student.enrollment?.school?.name || 'N/A'}
                          </td>
                          <td className="py-4 px-4 text-sm text-light-text-primary dark:text-dark-text-primary font-medium">
                            {student.enrollment?.classLevel || 'N/A'}
                          </td>
                          <td className="py-4 px-4 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {student.enrollment?.enrollmentDate 
                              ? new Date(student.enrollment.enrollmentDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : 'N/A'}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Admitted
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/school/students/${student.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transfer Info Modal */}
        {showTransferInfo && (
          <Modal
            isOpen={showTransferInfo}
            onClose={() => {
              setShowTransferInfo(false);
              setTransferId(null);
              router.push('/dashboard/school/admissions');
            }}
            title="Transfer Student Application"
          >
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                      Student Transfer Verified
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-400">
                      This application is for a student transferring from another school. 
                      Their academic history has been verified and will be included in their profile.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowTransferInfo(false);
                    setTransferId(null);
                    router.push('/dashboard/school/admissions');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleProceedFromTransfer}
                >
                  Proceed to Application Form
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* New Application Form Modal */}
        {showNewApplicationForm && (
          <Modal
            isOpen={showNewApplicationForm}
            onClose={() => {
              setShowNewApplicationForm(false);
              setTransferId(null);
              setSubmitError(null);
              setErrors({});
              setProfileImage(null);
              setSelectedImageFile(null);
              setFormData({
                firstName: '',
                middleName: '',
                lastName: '',
                dateOfBirth: '',
                age: '',
                gender: '',
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
              router.push('/dashboard/school/admissions');
            }}
            title={transferId ? 'Complete Transfer Application' : 'New Admission Application'}
            size="xl"
          >
            {submitError && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-300 mb-1">
                      Error
                    </p>
                    <p className="text-sm text-red-800 dark:text-red-400">
                      {submitError}
                    </p>
                    {submitError.includes('transfer') && (
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            router.push('/dashboard/school/transfers?new=true');
                            setShowNewApplicationForm(false);
                          }}
                        >
                          Go to Transfers
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmitApplication} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </h3>
                {/* Profile Image Upload */}
                <div className="mb-6">
                  <ImageUpload
                    label="Profile Image (Optional)"
                    value={profileImage}
                    onChange={setProfileImage}
                    onUpload={async (file) => {
                      setSelectedImageFile(file);
                      return URL.createObjectURL(file);
                    }}
                    helperText="Upload a passport-sized image (JPG, PNG, GIF, WEBP up to 5MB). Cropping will be applied."
                    disabled={isLoading || isAdmitting}
                    enableCrop={true}
                    aspectRatio={1}
                    cropShape="rect"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name *"
                    value={formData.firstName}
                    onChange={(e) => handleNameChange('firstName', e.target.value)}
                    required
                    error={errors.firstName}
                  />
                  <Input
                    label="Middle Name"
                    value={formData.middleName}
                    onChange={(e) => handleNameChange('middleName', e.target.value)}
                    error={errors.middleName}
                  />
                  <Input
                    label="Last Name *"
                    value={formData.lastName}
                    onChange={(e) => handleNameChange('lastName', e.target.value)}
                    required
                    error={errors.lastName}
                  />
                  <Input
                    label="Date of Birth *"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleDateOfBirthChange(e.target.value)}
                    required
                    error={errors.dateOfBirth}
                  />
                  <Input
                    label="Age"
                    value={formData.age}
                    readOnly
                    helperText="Calculated from date of birth"
                  />
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Gender *
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => {
                        setFormData({ ...formData, gender: e.target.value });
                        if (errors.gender) {
                          setErrors({ ...errors, gender: undefined });
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-md bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.gender
                          ? 'border-red-500 dark:border-red-500'
                          : 'border-light-border dark:border-dark-border'
                      }`}
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    {errors.gender && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.gender}</p>
                    )}
                  </div>
                  <Input
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (errors.email) {
                        setErrors({ ...errors, email: undefined });
                      }
                    }}
                    error={errors.email}
                  />
                  <Input
                    label="Phone *"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (errors.phone) {
                        setErrors({ ...errors, phone: undefined });
                      }
                    }}
                    required
                    error={errors.phone}
                  />
                  <Input
                    label="Address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="md:col-span-2"
                  />
                </div>
              </div>

              {/* Academic Information */}
              <div>
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Academic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Class Level *
                    </label>
                    <select
                      value={formData.classArmId || formData.classLevel}
                      onChange={(e) => {
                        const selectedValue = e.target.value;
                        // Find the selected class to check if it's a ClassArm
                        const selectedClass = classes.find((cls: any) => 
                          cls.classArmId === selectedValue || cls.id === selectedValue || cls.name === selectedValue
                        );
                        
                        if (selectedClass?.classArmId) {
                          // It's a ClassArm - store classArmId and classLevel
                          setFormData({ 
                            ...formData, 
                            classArmId: selectedClass.classArmId,
                            classLevel: selectedClass.classLevel || selectedClass.name,
                          });
                        } else {
                          // It's a legacy Class - store classLevel only
                          setFormData({ 
                            ...formData, 
                            classArmId: '',
                            classLevel: selectedClass?.name || selectedValue,
                          });
                        }
                        if (errors.classLevel) {
                          setErrors({ ...errors, classLevel: undefined });
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-md bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.classLevel
                          ? 'border-red-500 dark:border-red-500'
                          : 'border-light-border dark:border-dark-border'
                      }`}
                      required
                      disabled={classes.length === 0}
                    >
                      <option value="">{classes.length === 0 ? 'Loading classes...' : 'Select class'}</option>
                      {classes.map((cls: any) => (
                        <option key={cls.id} value={cls.classArmId || cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                    {errors.classLevel && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.classLevel}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Parent/Guardian Information */}
              <div>
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Parent/Guardian Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Parent/Guardian Name *"
                    value={formData.parentName}
                    onChange={(e) => handleNameChange('parentName', e.target.value)}
                    required
                    error={errors.parentName}
                  />
                  <Input
                    label="Relationship *"
                    value={formData.parentRelationship}
                    onChange={(e) => {
                      setFormData({ ...formData, parentRelationship: e.target.value });
                      if (errors.parentRelationship) {
                        setErrors({ ...errors, parentRelationship: undefined });
                      }
                    }}
                    placeholder="e.g., Father, Mother, Guardian"
                    required
                    error={errors.parentRelationship}
                  />
                  <Input
                    label="Parent Phone *"
                    type="tel"
                    value={formData.parentPhone}
                    onChange={(e) => {
                      setFormData({ ...formData, parentPhone: e.target.value });
                      if (errors.parentPhone) {
                        setErrors({ ...errors, parentPhone: undefined });
                      }
                    }}
                    required
                    error={errors.parentPhone}
                  />
                  <Input
                    label="Parent Email"
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => {
                      setFormData({ ...formData, parentEmail: e.target.value });
                      if (errors.parentEmail) {
                        setErrors({ ...errors, parentEmail: undefined });
                      }
                    }}
                    error={errors.parentEmail}
                  />
                </div>
              </div>

              {/* Health Information */}
              <div>
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4 flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Health Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Blood Group
                    </label>
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                      className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-md bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select blood group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                  <Input
                    label="Allergies"
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    placeholder="e.g., Peanuts, Dust"
                    helperText="Separate multiple allergies with commas"
                  />
                  <Input
                    label="Medications"
                    value={formData.medications}
                    onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                    placeholder="e.g., Inhaler (as needed)"
                    helperText="List any current medications"
                  />
                  <Input
                    label="Emergency Contact Name"
                    value={formData.emergencyContact}
                    onChange={(e) => {
                      const capitalized = capitalizeWords(e.target.value);
                      setFormData({ ...formData, emergencyContact: capitalized });
                      if (errors.emergencyContact) {
                        setErrors({ ...errors, emergencyContact: undefined });
                      }
                    }}
                    error={errors.emergencyContact}
                  />
                  <Input
                    label="Emergency Contact Phone"
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => {
                      setFormData({ ...formData, emergencyContactPhone: e.target.value });
                      if (errors.emergencyContactPhone) {
                        setErrors({ ...errors, emergencyContactPhone: undefined });
                      }
                    }}
                    error={errors.emergencyContactPhone}
                  />
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
                      Medical Notes
                    </label>
                    <textarea
                      value={formData.medicalNotes}
                      onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-light-border dark:border-dark-border rounded-md bg-light-card dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Any additional medical information or notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-dark-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowNewApplicationForm(false);
                    setTransferId(null);
                    setSubmitError(null);
                    setErrors({});
                    setProfileImage(null);
                    setSelectedImageFile(null);
                    setFormData({
                      firstName: '',
                      middleName: '',
                      lastName: '',
                      dateOfBirth: '',
                      age: '',
                      gender: '',
                      email: '',
                      phone: '',
                      address: '',
                      classLevel: '',
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
                    router.push('/dashboard/school/admissions');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isLoading || isAdmitting || !isFormValid()}
                >
                  {isLoading || isAdmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Submit Application
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </ProtectedRoute>
  );
}

export default function AdmissionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-light-text-secondary dark:text-dark-text-secondary">Loading...</div>
      </div>
    }>
      <AdmissionsPageContent />
    </Suspense>
  );
}

