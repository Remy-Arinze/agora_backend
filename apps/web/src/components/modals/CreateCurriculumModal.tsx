'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateCurriculumMutation } from '@/lib/store/api/schoolAdminApi';
import type { CreateCurriculumDto, CreateCurriculumItemDto } from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface CreateCurriculumModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  classId: string;
  subject?: string;
  academicYear: string;
  termId?: string;
  onSuccess?: () => void;
}

export function CreateCurriculumModal({
  isOpen,
  onClose,
  schoolId,
  classId,
  subject,
  academicYear,
  termId,
  onSuccess,
}: CreateCurriculumModalProps) {
  const [items, setItems] = useState<CreateCurriculumItemDto[]>([
    {
      week: 1,
      topic: '',
      objectives: [''],
      resources: [''],
      order: 0,
    },
  ]);

  const [createCurriculum, { isLoading }] = useCreateCurriculumMutation();

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setItems([
        {
          week: 1,
          topic: '',
          objectives: [''],
          resources: [''],
          order: 0,
        },
      ]);
    }
  }, [isOpen]);

  const addWeek = () => {
    setItems([
      ...items,
      {
        week: items.length + 1,
        topic: '',
        objectives: [''],
        resources: [''],
        order: items.length,
      },
    ]);
  };

  const removeWeek = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      // Re-number weeks
      newItems.forEach((item, i) => {
        item.week = i + 1;
        item.order = i;
      });
      setItems(newItems);
    }
  };

  const updateWeek = (index: number, field: keyof CreateCurriculumItemDto, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addObjective = (weekIndex: number) => {
    const newItems = [...items];
    newItems[weekIndex].objectives = [...newItems[weekIndex].objectives, ''];
    setItems(newItems);
  };

  const removeObjective = (weekIndex: number, objIndex: number) => {
    const newItems = [...items];
    if (newItems[weekIndex].objectives.length > 1) {
      newItems[weekIndex].objectives = newItems[weekIndex].objectives.filter((_, i) => i !== objIndex);
      setItems(newItems);
    }
  };

  const updateObjective = (weekIndex: number, objIndex: number, value: string) => {
    const newItems = [...items];
    newItems[weekIndex].objectives[objIndex] = value;
    setItems(newItems);
  };

  const addResource = (weekIndex: number) => {
    const newItems = [...items];
    newItems[weekIndex].resources = [...newItems[weekIndex].resources, ''];
    setItems(newItems);
  };

  const removeResource = (weekIndex: number, resIndex: number) => {
    const newItems = [...items];
    if (newItems[weekIndex].resources.length > 1) {
      newItems[weekIndex].resources = newItems[weekIndex].resources.filter((_, i) => i !== resIndex);
      setItems(newItems);
    }
  };

  const updateResource = (weekIndex: number, resIndex: number, value: string) => {
    const newItems = [...items];
    newItems[weekIndex].resources[resIndex] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all weeks have topics
    const invalidWeeks = items.filter((item) => !item.topic.trim());
    if (invalidWeeks.length > 0) {
      toast.error('Please provide a topic for all weeks');
      return;
    }

    // Filter out empty objectives and resources
    const curriculumData: CreateCurriculumDto = {
      classId,
      subject: subject || undefined,
      academicYear,
      termId: termId || undefined,
      items: items.map((item) => ({
        week: item.week,
        topic: item.topic.trim(),
        objectives: item.objectives.filter((obj) => obj.trim()).map((obj) => obj.trim()),
        resources: item.resources.filter((res) => res.trim()).map((res) => res.trim()),
        order: item.order,
      })),
    };

    // Ensure at least one objective per week
    const weeksWithoutObjectives = curriculumData.items.filter((item) => item.objectives.length === 0);
    if (weeksWithoutObjectives.length > 0) {
      toast.error('Each week must have at least one learning objective');
      return;
    }

    try {
      await createCurriculum({
        schoolId,
        curriculumData,
      }).unwrap();

      toast.success('Curriculum created successfully');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create curriculum');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Curriculum" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {items.map((item, weekIndex) => (
            <div
              key={weekIndex}
              className="p-4 border border-light-border dark:border-dark-border rounded-lg bg-light-surface dark:bg-dark-surface"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                  Week {item.week}
                </h3>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWeek(weekIndex)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                    Topic <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={item.topic}
                    onChange={(e) => updateWeek(weekIndex, 'topic', e.target.value)}
                    placeholder="e.g., Introduction to Algebra"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                      Learning Objectives <span className="text-red-500">*</span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addObjective(weekIndex)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Objective
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {item.objectives.map((objective, objIndex) => (
                      <div key={objIndex} className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={objective}
                          onChange={(e) => updateObjective(weekIndex, objIndex, e.target.value)}
                          placeholder="Enter learning objective"
                          required={objIndex === 0}
                        />
                        {item.objectives.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeObjective(weekIndex, objIndex)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                      Resources
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addResource(weekIndex)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Resource
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {item.resources.map((resource, resIndex) => (
                      <div key={resIndex} className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={resource}
                          onChange={(e) => updateResource(weekIndex, resIndex, e.target.value)}
                          placeholder="e.g., Textbook Chapter 1, Video Link"
                        />
                        {item.resources.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeResource(weekIndex, resIndex)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-light-border dark:border-dark-border">
          <Button
            type="button"
            variant="ghost"
            onClick={addWeek}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Week
          </Button>

          <div className="flex gap-3">
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
                'Create Curriculum'
              )}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

