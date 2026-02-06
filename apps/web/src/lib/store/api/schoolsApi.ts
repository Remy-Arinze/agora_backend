import { apiSlice } from './apiSlice';

// Types (these should match backend DTOs)
export interface SchoolAdmin {
  id: string;
  adminId?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  role: string;
  createdAt: string;
}

export interface Teacher {
  id: string;
  teacherId?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  employeeId: string | null;
  subject: string | null;
  isTemporary: boolean;
  createdAt: string;
}

export interface SchoolTypeContext {
  hasPrimary: boolean;
  hasSecondary: boolean;
  hasTertiary: boolean;
  isMixed: boolean;
  availableTypes: ('PRIMARY' | 'SECONDARY' | 'TERTIARY')[];
  primaryType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'MIXED';
}

export interface School {
  id: string;
  schoolId: string;
  name: string;
  subdomain: string;
  domain: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  logo: string | null;
  isActive: boolean;
  hasPrimary: boolean;
  hasSecondary: boolean;
  hasTertiary: boolean;
  createdAt: string;
  admins: SchoolAdmin[];
  teachers: Teacher[];
  teachersCount: number;
  studentsCount?: number;
  schoolType?: SchoolTypeContext;
  // Current admin info for permission checks (set on getMySchool)
  currentAdmin?: {
    id: string;
    role: string;
  };
}

export interface CreateSchoolDto {
  name: string;
  subdomain: string;
  domain?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  levels?: {
    primary?: boolean;
    secondary?: boolean;
    tertiary?: boolean;
  };
  principal?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  admins?: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
  }>;
}

/**
 * Permission assignment for new admin
 */
export interface AdminPermissionInput {
  resource: string; // PermissionResource enum value
  type: string; // PermissionType enum value (READ, WRITE, ADMIN)
}

export interface AddAdminDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  employeeId?: string;
  profileImage?: string;
  /**
   * Optional custom permissions to assign during creation.
   * If not provided, default READ permissions for all resources will be assigned.
   */
  permissions?: AdminPermissionInput[];
}

export interface AddTeacherDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  subject?: string;
  isTemporary?: boolean;
  employeeId?: string;
}

export interface UpdateAdminDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
}

export interface UpdateTeacherDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  subject?: string;
  isTemporary?: boolean;
}

export interface UpdatePrincipalDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ResponseDto<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  filter?: 'all' | 'active' | 'inactive';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// RTK Query endpoints for schools
export const schoolsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get all schools with pagination
    getSchools: builder.query<ResponseDto<PaginatedResponse<School>>, PaginationParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          if (params.page) searchParams.append('page', params.page.toString());
          if (params.limit) searchParams.append('limit', params.limit.toString());
          if (params.search) searchParams.append('search', params.search);
          if (params.filter) searchParams.append('filter', params.filter);
        }
        const queryString = searchParams.toString();
        return `/schools${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['School'],
    }),

    // Get school by ID
    getSchool: builder.query<ResponseDto<School>, string>({
      query: (id) => `/schools/${id}`,
      providesTags: (result, error, id) => [{ type: 'School', id }],
    }),

    // Create school
    createSchool: builder.mutation<ResponseDto<School>, CreateSchoolDto>({
      query: (body) => ({
        url: '/schools',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['School'],
    }),

    // Update school
    updateSchool: builder.mutation<ResponseDto<School>, { id: string; data: Partial<CreateSchoolDto> }>({
      query: ({ id, data }) => ({
        url: `/schools/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'School', id },
        'School',
      ],
    }),

    // Add admin to school
    addAdmin: builder.mutation<ResponseDto<SchoolAdmin>, { schoolId: string; admin: AddAdminDto }>({
      query: ({ schoolId, admin }) => ({
        url: `/schools/${schoolId}/admins`,
        method: 'POST',
        body: admin,
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Update admin in school
    updateAdmin: builder.mutation<ResponseDto<SchoolAdmin>, { schoolId: string; adminId: string; admin: UpdateAdminDto }>({
      query: ({ schoolId, adminId, admin }) => ({
        url: `/schools/${schoolId}/admins/${adminId}`,
        method: 'PATCH',
        body: admin,
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Add teacher to school
    addTeacher: builder.mutation<ResponseDto<Teacher>, { schoolId: string; teacher: AddTeacherDto }>({
      query: ({ schoolId, teacher }) => ({
        url: `/schools/${schoolId}/teachers`,
        method: 'POST',
        body: teacher,
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Update teacher in school
    updateTeacher: builder.mutation<ResponseDto<Teacher>, { schoolId: string; teacherId: string; teacher: UpdateTeacherDto }>({
      query: ({ schoolId, teacherId, teacher }) => ({
        url: `/schools/${schoolId}/teachers/${teacherId}`,
        method: 'PATCH',
        body: teacher,
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Delete teacher from school
    deleteTeacher: builder.mutation<ResponseDto<void>, { schoolId: string; teacherId: string }>({
      query: ({ schoolId, teacherId }) => ({
        url: `/schools/${schoolId}/teachers/${teacherId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Delete admin from school
    deleteAdmin: builder.mutation<ResponseDto<void>, { schoolId: string; adminId: string }>({
      query: ({ schoolId, adminId }) => ({
        url: `/schools/${schoolId}/admins/${adminId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Update principal in school
    updatePrincipal: builder.mutation<ResponseDto<SchoolAdmin>, { schoolId: string; principalId: string; principal: UpdatePrincipalDto }>({
      query: ({ schoolId, principalId, principal }) => ({
        url: `/schools/${schoolId}/principal/${principalId}`,
        method: 'PATCH',
        body: principal,
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Delete principal from school
    deletePrincipal: builder.mutation<ResponseDto<void>, { schoolId: string; principalId: string }>({
      query: ({ schoolId, principalId }) => ({
        url: `/schools/${schoolId}/principal/${principalId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Make an admin the principal
    makePrincipal: builder.mutation<ResponseDto<void>, { schoolId: string; adminId: string }>({
      query: ({ schoolId, adminId }) => ({
        url: `/schools/${schoolId}/admins/${adminId}/make-principal`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Convert teacher to admin
    convertTeacherToAdmin: builder.mutation<
      ResponseDto<void>,
      { schoolId: string; teacherId: string; role: string; keepAsTeacher: boolean }
    >({
      query: ({ schoolId, teacherId, role, keepAsTeacher }) => ({
        url: `/schools/${schoolId}/teachers/${teacherId}/convert-to-admin`,
        method: 'PATCH',
        body: { role, keepAsTeacher },
      }),
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Upload teacher profile image
    uploadTeacherImage: builder.mutation<ResponseDto<Teacher>, { schoolId: string; teacherId: string; file: File }>({
      queryFn: async ({ schoolId, teacherId, file }, _api, _extraOptions) => {
        const formData = new FormData();
        formData.append('image', file);
        
        const state = _api.getState() as { auth: { accessToken?: string | null; token?: string | null } };
        const token = state?.auth?.accessToken || state?.auth?.token;
        
        const tenantId = typeof window !== 'undefined' ? (localStorage.getItem('tenantId') || window.location.hostname.split('.')[0]) : null;
        
        const envUrl = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL;
        const baseUrl = envUrl || 'http://localhost:4000';
        const url = `${baseUrl}/schools/${schoolId}/teachers/${teacherId}/image`;
        
        const headers: HeadersInit = {};
        if (token) {
          headers['authorization'] = `Bearer ${token}`;
        }
        if (tenantId && !['localhost', 'www', 'api', 'app'].includes(tenantId)) {
          headers['x-tenant-id'] = tenantId;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Upload failed' }));
          return { error: { status: response.status, data: error } };
        }
        
        const data = await response.json();
        return { data };
      },
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),

    // Upload admin profile image
    uploadAdminImage: builder.mutation<ResponseDto<SchoolAdmin>, { schoolId: string; adminId: string; file: File }>({
      queryFn: async ({ schoolId, adminId, file }, _api, _extraOptions) => {
        const formData = new FormData();
        formData.append('image', file);
        
        const state = _api.getState() as { auth: { accessToken?: string | null; token?: string | null } };
        const token = state?.auth?.accessToken || state?.auth?.token;
        
        const tenantId = typeof window !== 'undefined' ? (localStorage.getItem('tenantId') || window.location.hostname.split('.')[0]) : null;
        
        const envUrl = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL;
        const baseUrl = envUrl || 'http://localhost:4000';
        const url = `${baseUrl}/schools/${schoolId}/admins/${adminId}/image`;
        
        const headers: HeadersInit = {};
        if (token) {
          headers['authorization'] = `Bearer ${token}`;
        }
        if (tenantId && !['localhost', 'www', 'api', 'app'].includes(tenantId)) {
          headers['x-tenant-id'] = tenantId;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Upload failed' }));
          return { error: { status: response.status, data: error } };
        }
        
        const data = await response.json();
        return { data };
      },
      invalidatesTags: (result, error, { schoolId }) => [
        { type: 'School', id: schoolId },
        'School',
      ],
    }),
  }),
});

export const {
  useGetSchoolsQuery,
  useGetSchoolQuery,
  useCreateSchoolMutation,
  useUpdateSchoolMutation,
  useAddAdminMutation,
  useUpdateAdminMutation,
  useAddTeacherMutation,
  useUpdateTeacherMutation,
  useDeleteTeacherMutation,
  useDeleteAdminMutation,
  useUpdatePrincipalMutation,
  useDeletePrincipalMutation,
  useMakePrincipalMutation,
  useConvertTeacherToAdminMutation,
  useUploadTeacherImageMutation,
  useUploadAdminImageMutation,
} = schoolsApi;

