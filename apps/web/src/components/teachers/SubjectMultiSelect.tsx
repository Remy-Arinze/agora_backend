'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { FadeInUp } from '@/components/ui/FadeInUp';
import { 
  Check, 
  X, 
  ChevronDown, 
  Search, 
  BookOpen, 
  Loader2,
  AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useGetSubjectsQuery, Subject } from '@/lib/store/api/schoolAdminApi';

interface SubjectMultiSelectProps {
  /** School ID for fetching subjects */
  schoolId: string;
  /** Selected subject IDs */
  selectedSubjectIds: string[];
  /** Callback when selection changes */
  onChange: (subjectIds: string[]) => void;
  /** Filter subjects by school type */
  schoolType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  /** Label for the field */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Placeholder when no subjects selected */
  placeholder?: string;
  /** Maximum number of subjects that can be selected */
  maxSelections?: number;
}

interface SubjectGroup {
  name: string;
  subjects: Subject[];
}

/**
 * Multi-select component for teacher subject competencies
 * Groups subjects by class level for secondary schools
 */
export function SubjectMultiSelect({
  schoolId,
  selectedSubjectIds,
  onChange,
  schoolType = 'SECONDARY',
  label = 'Subjects Teacher Can Teach',
  helperText,
  error,
  disabled = false,
  placeholder = 'Select subjects...',
  maxSelections,
}: SubjectMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch subjects for the school
  const {
    data: subjectsResponse,
    isLoading,
    error: fetchError,
  } = useGetSubjectsQuery(
    { schoolId, schoolType },
    { skip: !schoolId }
  );

  const subjects = useMemo(() => subjectsResponse?.data || [], [subjectsResponse]);

  // Group subjects by class level (for secondary schools)
  const groupedSubjects = useMemo(() => {
    if (schoolType !== 'SECONDARY') {
      return [{ name: 'All Subjects', subjects }];
    }

    const groups: Record<string, Subject[]> = {
      'General': [],
    };

    subjects.forEach((subject) => {
      if (subject.classLevelId && subject.classLevel) {
        const levelName = subject.classLevel.name;
        if (!groups[levelName]) {
          groups[levelName] = [];
        }
        groups[levelName].push(subject);
      } else {
        groups['General'].push(subject);
      }
    });

    // Convert to array and sort
    return Object.entries(groups)
      .filter(([_, subs]) => subs.length > 0)
      .map(([name, subs]) => ({
        name,
        subjects: subs.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        // Put General first, then sort alphabetically
        if (a.name === 'General') return -1;
        if (b.name === 'General') return 1;
        return a.name.localeCompare(b.name);
      });
  }, [subjects, schoolType]);

  // Filter subjects by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedSubjects;

    const query = searchQuery.toLowerCase();
    return groupedSubjects
      .map((group) => ({
        ...group,
        subjects: group.subjects.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.code?.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.subjects.length > 0);
  }, [groupedSubjects, searchQuery]);

  // Get selected subjects with details
  const selectedSubjects = useMemo(
    () => subjects.filter((s) => selectedSubjectIds.includes(s.id)),
    [subjects, selectedSubjectIds]
  );

  // Handle subject toggle
  const toggleSubject = useCallback(
    (subjectId: string) => {
      if (disabled) return;

      const isSelected = selectedSubjectIds.includes(subjectId);
      
      if (isSelected) {
        onChange(selectedSubjectIds.filter((id) => id !== subjectId));
      } else {
        if (maxSelections && selectedSubjectIds.length >= maxSelections) {
          return; // Don't add more if at max
        }
        onChange([...selectedSubjectIds, subjectId]);
      }
    },
    [selectedSubjectIds, onChange, disabled, maxSelections]
  );

  // Handle remove subject from selected
  const removeSubject = useCallback(
    (subjectId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      onChange(selectedSubjectIds.filter((id) => id !== subjectId));
    },
    [selectedSubjectIds, onChange, disabled]
  );

  // Select/deselect all in a group
  const toggleGroup = useCallback(
    (group: SubjectGroup) => {
      if (disabled) return;

      const groupIds = group.subjects.map((s) => s.id);
      const allSelected = groupIds.every((id) => selectedSubjectIds.includes(id));

      if (allSelected) {
        // Deselect all in group
        onChange(selectedSubjectIds.filter((id) => !groupIds.includes(id)));
      } else {
        // Select all in group (respecting max)
        const newIds = [...new Set([...selectedSubjectIds, ...groupIds])];
        if (maxSelections && newIds.length > maxSelections) {
          const availableSlots = maxSelections - selectedSubjectIds.length;
          const idsToAdd = groupIds
            .filter((id) => !selectedSubjectIds.includes(id))
            .slice(0, availableSlots);
          onChange([...selectedSubjectIds, ...idsToAdd]);
        } else {
          onChange(newIds);
        }
      }
    },
    [selectedSubjectIds, onChange, disabled, maxSelections]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-subject-multiselect]')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="space-y-2" data-subject-multiselect>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
          {label}
        </label>
      )}

      {/* Selected subjects display / Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          min-h-[42px] px-3 py-2 rounded-lg border cursor-pointer transition-colors
          ${disabled ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : 'hover:border-blue-400'}
          ${error ? 'border-red-500' : 'border-light-border dark:border-dark-border'}
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : ''}
        `}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex flex-wrap gap-2">
            {selectedSubjects.length === 0 ? (
              <span className="text-light-text-muted dark:text-dark-text-muted">
                {placeholder}
              </span>
            ) : (
              selectedSubjects.map((subject) => (
                <span
                  key={subject.id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md"
                >
                  {subject.name}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => removeSubject(subject.id, e)}
                      className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))
            )}
          </div>
          <ChevronDown
            className={`h-5 w-5 text-light-text-muted dark:text-dark-text-muted transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Helper text / Error */}
      {(helperText || error) && (
        <p className={`text-sm ${error ? 'text-red-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
          {error || helperText}
        </p>
      )}

      {/* Selection count */}
      {selectedSubjectIds.length > 0 && (
        <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
          {selectedSubjectIds.length} subject{selectedSubjectIds.length !== 1 ? 's' : ''} selected
          {maxSelections && ` (max ${maxSelections})`}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && (
          <FadeInUp
            from={{ opacity: 0, y: -10 }}
            to={{ opacity: 1, y: 0 }}
            duration={0.15}
            className="absolute z-50 mt-1 w-full max-w-md bg-light-card dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg shadow-xl overflow-hidden"
            style={{ maxHeight: '400px' }}
          >
            {/* Search */}
            <div className="p-2 border-b border-light-border dark:border-dark-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                <input
                  type="text"
                  placeholder="Search subjects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-light-border dark:border-dark-border rounded-md bg-light-bg dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Subject list */}
            <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: '340px' }}>
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Loading subjects...
                  </p>
                </div>
              ) : fetchError ? (
                <div className="p-4">
                  <Alert variant="error">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>Failed to load subjects. Please try again.</span>
                    </div>
                  </Alert>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-8 text-center">
                  <BookOpen className="h-8 w-8 text-light-text-muted dark:text-dark-text-muted mx-auto mb-2" />
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {searchQuery ? 'No subjects match your search' : 'No subjects available'}
                  </p>
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <div key={group.name}>
                    {/* Group header */}
                    <div
                      className="sticky top-0 px-3 py-2 bg-light-surface dark:bg-dark-bg border-b border-light-border dark:border-dark-border flex items-center justify-between cursor-pointer hover:bg-light-bg dark:hover:bg-dark-surface"
                      onClick={() => toggleGroup(group)}
                    >
                      <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                        {group.name}
                      </span>
                      <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                        {group.subjects.filter((s) => selectedSubjectIds.includes(s.id)).length}/{group.subjects.length}
                      </span>
                    </div>

                    {/* Subjects in group */}
                    {group.subjects.map((subject) => {
                      const isSelected = selectedSubjectIds.includes(subject.id);
                      const isDisabledByMax = !isSelected && maxSelections && selectedSubjectIds.length >= maxSelections;

                      return (
                        <div
                          key={subject.id}
                          onClick={() => !isDisabledByMax && toggleSubject(subject.id)}
                          className={`
                            px-3 py-2 flex items-center gap-3 cursor-pointer transition-colors
                            ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-light-surface dark:hover:bg-dark-bg'}
                            ${isDisabledByMax ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          <div
                            className={`
                              flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                              ${isSelected
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-light-border dark:border-dark-border'
                              }
                            `}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary truncate">
                              {subject.name}
                            </p>
                            {subject.code && (
                              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                {subject.code}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer actions */}
            <div className="p-2 border-t border-light-border dark:border-dark-border flex justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                disabled={selectedSubjectIds.length === 0}
              >
                Clear all
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Done ({selectedSubjectIds.length})
              </Button>
            </div>
          </FadeInUp>
        )}
    </div>
  );
}

export default SubjectMultiSelect;

