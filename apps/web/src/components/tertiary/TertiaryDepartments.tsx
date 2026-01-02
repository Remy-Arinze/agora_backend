'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Plus,
  Search,
  GraduationCap,
  Loader2,
  Edit2,
  Trash2,
  Library,
  Layers,
  Filter,
  X,
  ChevronDown,
} from 'lucide-react';
import { EntityAvatar } from '@/components/ui/EntityAvatar';
import {
  useGetDepartmentsQuery,
  useGetFacultiesQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  type Department,
  type Faculty,
} from '@/lib/store/api/schoolAdminApi';
import toast from 'react-hot-toast';
import { CreateDepartmentModal } from '@/components/modals/CreateDepartmentModal';
import { EditDepartmentModal } from '@/components/modals/EditDepartmentModal';
import { DeleteDepartmentModal } from '@/components/modals/DeleteDepartmentModal';

interface TertiaryDepartmentsProps {
  schoolId: string;
}

export function TertiaryDepartments({ schoolId }: TertiaryDepartmentsProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<Set<string>>(new Set());
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{ isOpen: boolean; department: Department | null }>({
    isOpen: false,
    department: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; department: Department | null }>({
    isOpen: false,
    department: null,
  });

  // Fetch data
  const { data: departmentsResponse, isLoading: isLoadingDepts } = useGetDepartmentsQuery({ schoolId });
  const { data: facultiesResponse, isLoading: isLoadingFaculties } = useGetFacultiesQuery({ schoolId });

  const departments = departmentsResponse?.data || [];
  const faculties = facultiesResponse?.data || [];

  // Create a map of faculty IDs to faculty objects for quick lookup
  const facultyMap = useMemo(() => {
    const map: Record<string, Faculty> = {};
    faculties.forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [faculties]);

  // Mutations
  const [createDepartment, { isLoading: isCreating }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: isUpdating }] = useUpdateDepartmentMutation();
  const [deleteDepartment, { isLoading: isDeleting }] = useDeleteDepartmentMutation();

  // Filter departments by search and faculties
  const filteredDepartments = useMemo(() => {
    let filtered = [...departments];

    // Filter by faculties (multi-select)
    if (selectedFacultyIds.size > 0) {
      filtered = filtered.filter((dept) => dept.facultyId && selectedFacultyIds.has(dept.facultyId));
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (dept) =>
          dept.name.toLowerCase().includes(query) ||
          dept.code.toLowerCase().includes(query) ||
          dept.facultyName?.toLowerCase().includes(query)
      );
    }

    // Sort by faculty name, then department name
    filtered.sort((a, b) => {
      const facultyCompare = (a.facultyName || '').localeCompare(b.facultyName || '');
      if (facultyCompare !== 0) return facultyCompare;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [departments, searchQuery, selectedFacultyIds]);

  const toggleFacultyFilter = (facultyId: string) => {
    setSelectedFacultyIds((prev) => {
      const next = new Set(prev);
      if (next.has(facultyId)) {
        next.delete(facultyId);
      } else {
        next.add(facultyId);
      }
      return next;
    });
  };

  const selectAllFaculties = () => {
    setSelectedFacultyIds(new Set(faculties.map((f) => f.id)));
  };

  const clearFacultyFilter = () => {
    setSelectedFacultyIds(new Set());
  };

  const handleDepartmentClick = (departmentId: string) => {
    router.push(`/dashboard/school/departments/${departmentId}`);
  };

  const handleCreateDepartment = async (data: { name: string; code: string; description?: string; facultyId: string }) => {
    try {
      await createDepartment({ schoolId, data }).unwrap();
      toast.success(`Department "${data.name}" created successfully`);
      setShowCreateModal(false);
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create department');
    }
  };

  const handleUpdateDepartment = async (data: { name?: string; code?: string; description?: string; facultyId?: string }) => {
    if (!editModal.department) return;
    try {
      await updateDepartment({ schoolId, departmentId: editModal.department.id, data }).unwrap();
      toast.success('Department updated successfully');
      setEditModal({ isOpen: false, department: null });
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update department');
    }
  };

  const handleDeleteDepartment = async (force?: boolean) => {
    if (!deleteModal.department) return false;
    try {
      await deleteDepartment({ schoolId, departmentId: deleteModal.department.id, force }).unwrap();
      toast.success('Department deleted successfully');
      setDeleteModal({ isOpen: false, department: null });
      return true;
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete department');
      return false;
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedFacultyIds(new Set());
  };

  // Handle click outside to close dropdown
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLoading = isLoadingDepts || isLoadingFaculties;
  const hasActiveFilters = searchQuery || selectedFacultyIds.size > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Show message if no faculties exist
  if (faculties.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
              Departments
            </h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Manage academic departments
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Library className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
              No faculties found. Create faculties first before adding departments.
            </p>
            <Button variant="primary" onClick={() => router.push('/dashboard/school/faculties')}>
              <Library className="h-4 w-4 mr-2" />
              Go to Faculties
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Departments
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            {departments.length} department{departments.length !== 1 ? 's' : ''} across {faculties.length} facult{faculties.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Department
        </Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-light-text-muted dark:text-dark-text-muted" />
              <Input
                placeholder="Search departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Faculty Filter - Multi-select */}
            <div ref={filterDropdownRef} className="relative sm:w-64">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="w-full flex items-center justify-between pl-10 pr-4 py-2 border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-light-text-muted dark:text-dark-text-muted" />
                <span className="truncate">
                  {selectedFacultyIds.size === 0
                    ? 'All Faculties'
                    : selectedFacultyIds.size === 1
                      ? facultyMap[Array.from(selectedFacultyIds)[0]]?.name || 'Selected'
                      : `${selectedFacultyIds.size} Faculties`}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showFilterDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {/* Quick actions */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-light-border dark:border-dark-border bg-light-background dark:bg-dark-background">
                    <button
                      onClick={selectAllFaculties}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearFacultyFilter}
                      className="text-xs text-light-text-muted hover:text-light-text-secondary dark:text-dark-text-muted"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Faculty checkboxes */}
                  {faculties.map((faculty) => (
                    <label
                      key={faculty.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-light-background dark:hover:bg-dark-background cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFacultyIds.has(faculty.id)}
                        onChange={() => toggleFacultyFilter(faculty.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-light-text-primary dark:text-dark-text-primary truncate">
                        {faculty.name}
                      </span>
                    </label>
                  ))}

                  {faculties.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-light-text-muted dark:text-dark-text-muted">
                      No faculties found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="sm:w-auto">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Active filter indicator */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
              <span>Showing {filteredDepartments.length} of {departments.length} departments</span>
              {Array.from(selectedFacultyIds).map((facultyId) => (
                facultyMap[facultyId] && (
                  <span
                    key={facultyId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs"
                  >
                    {facultyMap[facultyId].name}
                    <button
                      onClick={() => toggleFacultyFilter(facultyId)}
                      className="hover:text-purple-900 dark:hover:text-purple-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Departments Grid */}
      {filteredDepartments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 text-light-text-muted dark:text-dark-text-muted mx-auto mb-4" />
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
              {hasActiveFilters
                ? 'No departments found matching your filters.'
                : 'No departments created yet.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Department
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartments.map((dept, index) => (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card
                className="hover:shadow-lg transition-all cursor-pointer group h-full"
                onClick={() => handleDepartmentClick(dept.id)}
              >
                <CardContent className="pt-6">
                  {/* Faculty Badge */}
                  {dept.facultyName && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium">
                        <Library className="h-3 w-3" />
                        {dept.facultyName}
                      </span>
                    </div>
                  )}

                  {/* Department Info */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <EntityAvatar
                        name={dept.name}
                        imageUrl={dept.imageUrl}
                        size="md"
                        variant="square"
                      />
                      <div>
                        <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                          {dept.name}
                        </h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          {dept.code}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-4 w-4" />
                      {dept.levelsCount} level{dept.levelsCount !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4" />
                      {dept.studentsCount} student{dept.studentsCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-light-border dark:border-dark-border opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditModal({ isOpen: true, department: dept });
                      }}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModal({ isOpen: true, department: dept });
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateDepartmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateDepartment}
        isLoading={isCreating}
        faculties={faculties}
      />

      {editModal.department && (
        <EditDepartmentModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, department: null })}
          onSubmit={handleUpdateDepartment}
          isLoading={isUpdating}
          department={editModal.department}
          faculties={faculties}
        />
      )}

      {deleteModal.department && (
        <DeleteDepartmentModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, department: null })}
          onConfirm={handleDeleteDepartment}
          isLoading={isDeleting}
          department={deleteModal.department}
        />
      )}
    </div>
  );
}

