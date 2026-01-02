import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserWithContext } from '../../auth/types/user-with-context.type';

/**
 * Guard that ensures students can only access their own data
 * 
 * For STUDENT:
 * - Verifies the studentId in the request matches the logged-in student
 * - Allows access to their own data across all schools (for transcripts)
 * 
 * For SCHOOL_ADMIN/TEACHER:
 * - Verifies the student is enrolled in their school (active enrollment)
 * 
 * For SUPER_ADMIN:
 * - Can access any student's data
 */
@Injectable()
export class StudentDataAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: UserWithContext = request.user;
    const studentId = request.params.studentId || request.params.id;

    // Super admin can access any student
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // School admin/teacher can access students from their school
    if (user.role === 'SCHOOL_ADMIN' || user.role === 'TEACHER') {
      const schoolId = user.currentSchoolId || request.schoolId;
      
      if (!schoolId) {
        throw new ForbiddenException('School context is required');
      }

      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          studentId,
          schoolId,
          isActive: true,
        },
      });
      
      if (!enrollment) {
        throw new ForbiddenException('Student is not enrolled in your school');
      }
      return true;
    }

    // ✅ Student can only access their own data
    if (user.role === 'STUDENT') {
      const student = await this.prisma.student.findUnique({
        where: { userId: user.id },
      });
      
      if (!student || student.id !== studentId) {
        throw new ForbiddenException('You can only access your own data');
      }
      return true;
    }

    return false;
  }
}

