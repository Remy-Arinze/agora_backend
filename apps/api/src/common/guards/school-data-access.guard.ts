import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserWithContext } from '../../auth/types/user-with-context.type';

/**
 * Guard that enforces school-level data isolation
 * 
 * For SCHOOL_ADMIN and TEACHER:
 * - Extracts schoolId from JWT (set at login based on public ID used)
 * - Verifies user has access to that school
 * - Attaches schoolId to request for use in services/repositories
 * 
 * For SUPER_ADMIN:
 * - Allows access to any school (no restrictions)
 * 
 * For STUDENT:
 * - Extracts schoolId from JWT (set at login based on active enrollment)
 * - If no schoolId in JWT, tries to find active enrollment
 * - Allows access even without active enrollment (for transcript access)
 */
@Injectable()
export class SchoolDataAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: UserWithContext = request.user;
    const requestedSchoolId = request.params.schoolId || request.body.schoolId;

    // ✅ Super admin can access any school - no school context needed
    // Super admin JWT will NOT have schoolId (they log in with email)
    if (user.role === 'SUPER_ADMIN') {
      // Super admin can optionally specify schoolId in request to access specific school
      // If not specified, they can still access (for global operations)
      if (requestedSchoolId) {
        request.schoolId = requestedSchoolId;
      }
      // ✅ No schoolId restriction for super admin
      return true;
    }

    // ✅ Use schoolId from JWT (logged-in school context)
    // Note: SUPER_ADMIN won't have schoolId (they log in with email, not public ID)
    const userSchoolId = user.currentSchoolId;

    if (!userSchoolId) {
      // ✅ This is expected for SUPER_ADMIN (they log in with email, no school context)
      if (user.role === 'SUPER_ADMIN') {
        return true; // Super admin can access any school
      }

      // ✅ STUDENT: If no schoolId in JWT, try to find active enrollment
      if (user.role === 'STUDENT') {
        const student = await this.prisma.student.findUnique({
          where: { userId: user.id },
          include: {
            enrollments: {
              where: { isActive: true },
              orderBy: { enrollmentDate: 'desc' },
              take: 1,
            },
          },
        });

        if (student && student.enrollments.length > 0) {
          request.schoolId = student.enrollments[0].schoolId;
          return true;
        }
        // Student with no active enrollment - can still access transcripts
        return true;
      }

      // For SCHOOL_ADMIN/TEACHER, this means they logged in with email (legacy/backward compat)
      // Fallback: Try to extract from relations (for backward compatibility)
      const fallbackSchoolId = this.extractSchoolIdFromUser(user);
      if (!fallbackSchoolId) {
        throw new ForbiddenException('User is not associated with any school');
      }
      request.schoolId = fallbackSchoolId;
      return true;
    }

    // ✅ Verify user belongs to the school they're trying to access
    if (requestedSchoolId && requestedSchoolId !== userSchoolId) {
      throw new ForbiddenException('You can only access data from your own school');
    }

    // ✅ Verify the schoolId in JWT is valid for this user
    const isValidSchool = await this.verifyUserSchoolAccess(user.id, userSchoolId, user.role);
    if (!isValidSchool) {
      throw new ForbiddenException('Invalid school context');
    }

    // Attach school context to request
    request.schoolId = userSchoolId;
    return true;
  }

  private async verifyUserSchoolAccess(
    userId: string,
    schoolId: string,
    role: string
  ): Promise<boolean> {
    // For STUDENT, verify they have an enrollment (active or inactive) in this school
    if (role === 'STUDENT') {
      const student = await this.prisma.student.findUnique({
        where: { userId },
      });
      
      if (!student) {
        return false;
      }

      const enrollment = await this.prisma.enrollment.findFirst({
        where: { studentId: student.id, schoolId },
      });
      return !!enrollment;
    }

    // For SCHOOL_ADMIN/TEACHER, verify they have a profile in this school
    const schoolAdmin = await this.prisma.schoolAdmin.findFirst({
      where: { userId, schoolId },
    });

    if (schoolAdmin) return true;

    const teacher = await this.prisma.teacher.findFirst({
      where: { userId, schoolId },
    });

    return !!teacher;
  }

  private extractSchoolIdFromUser(user: UserWithContext): string | null {
    // Fallback method - only used if JWT doesn't have schoolId
    if (user.schoolAdmins && user.schoolAdmins.length > 0) {
      return user.schoolAdmins[0].schoolId;
    }
    if (user.teacherProfiles && user.teacherProfiles.length > 0) {
      return user.teacherProfiles[0].schoolId;
    }
    return null;
  }
}

