import { z } from 'zod';

// Validation schema for admin form
export const adminFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required').min(10, 'Phone number must be at least 10 characters'),
  role: z.string().min(1, 'Role is required').min(2, 'Role must be at least 2 characters').max(50, 'Role must be at most 50 characters'),
});

// Validation schema for update admin form (no email)
export const updateAdminFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters'),
  phone: z.string().min(1, 'Phone number is required').min(10, 'Phone number must be at least 10 characters'),
  role: z.string().min(1, 'Role is required').min(2, 'Role must be at least 2 characters').max(50, 'Role must be at most 50 characters'),
});

// Validation schema for update principal form
export const updatePrincipalFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters'),
  phone: z.string().min(1, 'Phone number is required').min(10, 'Phone number must be at least 10 characters'),
});

// Validation schema for update teacher form (no email)
export const updateTeacherFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters'),
  phone: z.string().min(1, 'Phone number is required').min(10, 'Phone number must be at least 10 characters'),
  subject: z.string().optional(),
  isTemporary: z.boolean().optional(),
});

// Validation schema for adding a teacher
export const addTeacherFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required').min(10, 'Phone number must be at least 10 characters'),
  subject: z.string().optional(),
  isTemporary: z.boolean().optional().default(false),
  employeeId: z.string().optional(),
});

// Validation schema for adding an admin (with custom role support)
export const addAdminFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required').min(10, 'Phone number must be at least 10 characters'),
  role: z.string().min(1, 'Role is required').min(2, 'Role must be at least 2 characters').max(50, 'Role must be at most 50 characters'),
  employeeId: z.string().optional(),
});

// Validation schema for student admission
export const studentAdmissionFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters'),
  dateOfBirth: z.string().min(1, 'Date of birth is required').refine(
    (date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
      return actualAge >= 3 && actualAge <= 25;
    },
    { message: 'Student age must be between 3 and 25 years' }
  ),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone number is required').min(10, 'Phone number must be at least 10 characters'),
  address: z.string().optional(),
  classLevel: z.string().min(1, 'Class level is required'),
  academicYear: z.string().optional(),
  // Parent/Guardian Information
  parentName: z.string().min(1, 'Parent/Guardian name is required').min(2, 'Parent/Guardian name must be at least 2 characters'),
  parentPhone: z.string().min(1, 'Parent/Guardian phone is required').min(10, 'Parent/Guardian phone must be at least 10 characters'),
  parentEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  parentRelationship: z.string().min(1, 'Relationship is required'),
  // Health Information (Optional)
  bloodGroup: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactPhone: z
    .union([
      z.string().min(10, 'Emergency contact phone must be at least 10 characters'),
      z.literal(''),
    ])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  medicalNotes: z.string().optional(),
});

