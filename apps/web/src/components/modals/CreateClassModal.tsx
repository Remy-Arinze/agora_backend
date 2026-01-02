'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Checkbox } from '@/components/ui/Checkbox';
import { Alert } from '@/components/ui/Alert';
import {
  useCreateClassMutation,
  useCreateClassArmMutation,
  useGetClassLevelsQuery,
  useGetClassArmsQuery,
  useGetActiveSessionQuery,
  type CreateClassDto,
  type CreateClassArmDto,
} from '@/lib/store/api/schoolAdminApi';
import { useSchoolType } from '@/hooks/useSchoolType';
import { getTerminology } from '@/lib/utils/terminology';
import toast from 'react-hot-toast';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
}

export function CreateClassModal({ isOpen, onClose, schoolId }: CreateClassModalProps) {
  const { currentType } = useSchoolType();
  const terminology = getTerminology(currentType);
  const isTertiary = currentType === 'TERTIARY';
  const isPrimaryOrSecondary = currentType === 'PRIMARY' || currentType === 'SECONDARY';

  // Get active session for academic year
  const { data: activeSessionResponse } = useGetActiveSessionQuery(
    { schoolId },
    { skip: !schoolId }
  );
  const activeSession = activeSessionResponse?.data;
  const defaultAcademicYear = activeSession?.session?.name || '2024/2025';

  // Get ClassLevels for PRIMARY/SECONDARY - filter by current school type
  const { data: classLevelsResponse } = useGetClassLevelsQuery(
    { 
      schoolId, 
      schoolType: isPrimaryOrSecondary ? (currentType as 'PRIMARY' | 'SECONDARY') : undefined 
    },
    { skip: !schoolId || !isPrimaryOrSecondary || !currentType }
  );
  const classLevels = classLevelsResponse?.data || [];

  // Get existing ClassArms to check if school uses ClassArms
  const { data: classArmsResponse } = useGetClassArmsQuery(
    { schoolId, schoolType: currentType || undefined },
    { skip: !schoolId || !isPrimaryOrSecondary }
  );
  const existingClassArms = classArmsResponse?.data || [];
  const schoolUsesClassArms = existingClassArms.length > 0;

  // Form state
  const [useClassArms, setUseClassArms] = useState(schoolUsesClassArms);
  const [classLevelId, setClassLevelId] = useState('');
  const [armName, setArmName] = useState('');
  const [capacity, setCapacity] = useState<number | undefined>(undefined);
  const [className, setClassName] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [code, setCode] = useState('');
  const [creditHours, setCreditHours] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mutations
  const [createClass, { isLoading: isCreatingClass }] = useCreateClassMutation();
  const [createClassArm, { isLoading: isCreatingArm }] = useCreateClassArmMutation();

  const isLoading = isCreatingClass || isCreatingArm;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setUseClassArms(schoolUsesClassArms);
      setClassLevelId('');
      setArmName('');
      setCapacity(undefined);
      setClassName('');
      setClassLevel('');
      setCode('');
      setCreditHours(undefined);
      setDescription('');
      setErrors({});
    }
  }, [isOpen, schoolUsesClassArms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (isTertiary) {
      if (!className.trim()) {
        setErrors({ className: 'Class name is required' });
        return;
      }
    } else if (isPrimaryOrSecondary) {
      if (useClassArms) {
        if (!classLevelId) {
          setErrors({ classLevelId: 'Class level is required' });
          return;
        }
        if (!armName.trim()) {
          setErrors({ armName: 'ClassArm name is required' });
          return;
        }
      } else {
        if (!className.trim()) {
          setErrors({ className: 'Class name is required' });
          return;
        }
        if (!classLevel.trim()) {
          setErrors({ classLevel: 'Class level is required' });
          return;
        }
      }
    }

    try {
      if (isTertiary) {
        // Create Class for TERTIARY
        const classData: CreateClassDto = {
          name: className.trim(),
          code: code.trim() || undefined,
          type: 'TERTIARY',
          academicYear: defaultAcademicYear,
          creditHours: creditHours || undefined,
          description: description.trim() || undefined,
        };

        await createClass({ schoolId, classData }).unwrap();
        toast.success('Class created successfully');
        onClose();
      } else if (isPrimaryOrSecondary) {
        if (useClassArms) {
          // Create ClassArm for PRIMARY/SECONDARY
          const armData: CreateClassArmDto = {
            name: armName.trim(),
            classLevelId: classLevelId,
            capacity: capacity || undefined,
          };

          await createClassArm({ schoolId, data: armData }).unwrap();
          toast.success('ClassArm created successfully');
          onClose();
        } else {
          // Create Class for PRIMARY/SECONDARY (backward compatibility)
          const classData: CreateClassDto = {
            name: className.trim(),
            classLevel: classLevel.trim(),
            type: currentType!,
            academicYear: defaultAcademicYear,
            description: description.trim() || undefined,
          };

          await createClass({ schoolId, classData }).unwrap();
          toast.success('Class created successfully');
          onClose();
        }
      }
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create class');
      if (error?.data?.errors) {
        setErrors(error.data.errors);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-light-card dark:bg-dark-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
              Add {terminology.courseSingular}
            </h2>
            <button
              onClick={onClose}
              className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
              disabled={isLoading}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* TERTIARY: Class Form */}
            {isTertiary && (
              <>
                <div>
                  <Label htmlFor="className">Class Name *</Label>
                  <Input
                    id="className"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g., Introduction to Computer Science"
                    className={errors.className ? 'border-red-500' : ''}
                  />
                  {errors.className && (
                    <p className="text-sm text-red-500 mt-1">{errors.className}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="code">Course Code</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g., CS101"
                  />
                </div>

                <div>
                  <Label htmlFor="creditHours">Credit Hours</Label>
                  <Input
                    id="creditHours"
                    type="number"
                    value={creditHours || ''}
                    onChange={(e) => setCreditHours(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="e.g., 3"
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Course description..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary min-h-[100px]"
                  />
                </div>
              </>
            )}

            {/* PRIMARY/SECONDARY: ClassArms or Classes */}
            {isPrimaryOrSecondary && (
              <>
                {/* Use ClassArms Toggle */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useClassArms"
                    checked={useClassArms}
                    onCheckedChange={(checked) => setUseClassArms(checked === true)}
                  />
                  <Label htmlFor="useClassArms" className="cursor-pointer">
                    Use ClassArms (e.g., JSS 1 Gold, JSS 1 Blue)
                  </Label>
                </div>

                {useClassArms ? (
                  <>
                    {/* ClassArm Form */}
                    <div>
                      <Label htmlFor="classLevelId">Class Level *</Label>
                      <select
                        id="classLevelId"
                        value={classLevelId}
                        onChange={(e) => setClassLevelId(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary ${
                          errors.classLevelId ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                        disabled={!currentType || classLevels.length === 0}
                      >
                        <option value="">
                          {!currentType 
                            ? 'Select school type first...' 
                            : classLevels.length === 0 
                            ? 'No class levels available for this school type'
                            : 'Select Class Level...'}
                        </option>
                        {classLevels
                          .filter((level) => !currentType || level.type === currentType)
                          .map((level) => (
                            <option key={level.id} value={level.id}>
                              {level.name}
                            </option>
                          ))}
                      </select>
                      {errors.classLevelId && (
                        <p className="text-sm text-red-500 mt-1">{errors.classLevelId}</p>
                      )}
                      {currentType && (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                          Showing {currentType} class levels only
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="armName">ClassArm Name *</Label>
                      <Input
                        id="armName"
                        value={armName}
                        onChange={(e) => setArmName(e.target.value)}
                        placeholder="e.g., Gold, Blue, Red, A, B"
                        className={errors.armName ? 'border-red-500' : ''}
                      />
                      {errors.armName && (
                        <p className="text-sm text-red-500 mt-1">{errors.armName}</p>
                      )}
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        This will create "{classLevels.find(l => l.id === classLevelId)?.name || 'Class Level'} {armName || 'Arm'}"
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="capacity">Capacity (Optional)</Label>
                      <Input
                        id="capacity"
                        type="number"
                        value={capacity || ''}
                        onChange={(e) => setCapacity(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="e.g., 30"
                        min="1"
                      />
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        Maximum number of students in this ClassArm
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Class Form (Backward Compatibility) */}
                    <div>
                      <Label htmlFor="className">Class Name *</Label>
                      <Input
                        id="className"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="e.g., JSS1, Class 1"
                        className={errors.className ? 'border-red-500' : ''}
                      />
                      {errors.className && (
                        <p className="text-sm text-red-500 mt-1">{errors.className}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="classLevel">Class Level *</Label>
                      <Input
                        id="classLevel"
                        value={classLevel}
                        onChange={(e) => setClassLevel(e.target.value)}
                        placeholder="e.g., JSS1, Class 1"
                        className={errors.classLevel ? 'border-red-500' : ''}
                      />
                      {errors.classLevel && (
                        <p className="text-sm text-red-500 mt-1">{errors.classLevel}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Class description..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary min-h-[100px]"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Academic Year Display */}
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              Academic Year: <span className="font-medium">{defaultAcademicYear}</span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-dark-border">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create ${terminology.courseSingular}`
                )}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

