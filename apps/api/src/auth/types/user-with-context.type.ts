import { User } from '@prisma/client';

/**
 * Extended User type that includes school context from JWT
 * This context is set at login time and represents the current school the user is operating in
 */
export interface UserWithContext extends User {
  currentSchoolId?: string | null;
  currentPublicId?: string | null;
  currentProfileId?: string | null;
}

/**
 * JWT Payload interface
 * Includes optional school context for users who need it
 */
export interface JwtPayload {
  sub: string; // userId
  role: string; // UserRole
  schoolId?: string; // Current school context (for SCHOOL_ADMIN, TEACHER, STUDENT)
  publicId?: string; // Public ID used for login (for SCHOOL_ADMIN, TEACHER)
  profileId?: string; // adminId or teacherId (for SCHOOL_ADMIN, TEACHER)
}
