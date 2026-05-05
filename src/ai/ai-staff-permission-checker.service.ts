import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  PermissionResource,
  PermissionType,
  isPrincipalRole,
} from '../schools/dto/permission.dto';
import { PrismaService } from '../database/prisma.service';

/**
 * Hierarchical staff permission checks (aligned with {@link PermissionGuard}).
 * Used by Lois tool execution so school admins cannot bypass route intent via the model.
 */
@Injectable()
export class AiStaffPermissionCheckerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enforces staff permissions for Lois agent tools (school admins).
   * Teachers and students are handled separately; SUPER_ADMIN is allowed for all tools.
   */
  async assertLoisToolAllowed(params: {
    toolName: string;
    userRole?: string;
    userId?: string;
    schoolId?: string;
  }): Promise<void> {
    const { toolName, userRole, userId, schoolId } = params;

    if (userRole === 'SUPER_ADMIN') {
      return;
    }
    if (userRole === 'TEACHER') {
      return;
    }
    if (userRole === 'STUDENT') {
      const blocked = ['execute_sql', 'get_school_stats', 'get_academic_risk_summary'];
      if (blocked.includes(toolName)) {
        throw new ForbiddenException('This assistant action is not available for students.');
      }
      return;
    }
    if (userRole !== 'SCHOOL_ADMIN' || !userId || !schoolId) {
      throw new ForbiddenException('School context is required for this assistant action.');
    }

    const admin = await this.prisma.schoolAdmin.findFirst({
      where: { userId, schoolId },
      select: { id: true, role: true },
    });
    if (!admin) {
      throw new ForbiddenException('School admin profile not found for this school.');
    }
    if (isPrincipalRole(admin.role)) {
      return;
    }

    const id = admin.id;
    switch (toolName) {
      case 'execute_sql':
      case 'search_semantic':
        if (!(await this.schoolAdminHasPermission(id, PermissionResource.ANALYTICS, PermissionType.READ))) {
          throw new ForbiddenException('You need Analytics (read) access to search records or the knowledge base.');
        }
        return;
      case 'get_school_stats':
        if (
          !(await this.schoolAdminHasAny(id, [
            { resource: PermissionResource.OVERVIEW, type: PermissionType.READ },
            { resource: PermissionResource.ANALYTICS, type: PermissionType.READ },
          ]))
        ) {
          throw new ForbiddenException(
            'You need Overview or Analytics (read) access to view school statistics.',
          );
        }
        return;
      case 'get_academic_risk_summary':
        if (
          !(await this.schoolAdminHasAny(id, [
            { resource: PermissionResource.GRADES, type: PermissionType.READ },
            { resource: PermissionResource.ANALYTICS, type: PermissionType.READ },
          ]))
        ) {
          throw new ForbiddenException(
            'You need Grades or Analytics (read) access to view academic risk summaries.',
          );
        }
        return;
      case 'grade_essay':
        if (!(await this.schoolAdminHasPermission(id, PermissionResource.GRADES, PermissionType.READ))) {
          throw new ForbiddenException('You need Grades (read) access to use essay grading.');
        }
        return;
      case 'generate_lesson_plan':
      case 'generate_quiz':
      case 'generate_flashcards':
      case 'generate_summary':
      case 'generate_assessment':
        if (!(await this.schoolAdminHasPermission(id, PermissionResource.CURRICULUM, PermissionType.READ))) {
          throw new ForbiddenException('You need Curriculum (read) access to generate this content.');
        }
        return;
      default:
        return;
    }
  }

  /**
   * Same semantics as PermissionGuard for non-principal school admins:
   * ADMIN on resource wins; otherwise READ allows READ; WRITE allows WRITE+READ.
   */
  async schoolAdminHasPermission(
    adminId: string,
    resource: PermissionResource,
    requiredType: PermissionType,
  ): Promise<boolean> {
    const hasAdminOnResource = await this.prisma.staffPermission.findFirst({
      where: {
        adminId,
        permission: { resource, type: PermissionType.ADMIN },
      },
    });
    if (hasAdminOnResource) return true;

    const allowedTypes: PermissionType[] = [PermissionType.ADMIN];
    if (requiredType === PermissionType.WRITE) {
      allowedTypes.push(PermissionType.WRITE);
    } else if (requiredType === PermissionType.READ) {
      allowedTypes.push(PermissionType.WRITE, PermissionType.READ);
    }

    const row = await this.prisma.staffPermission.findFirst({
      where: {
        adminId,
        permission: { resource, type: { in: allowedTypes } },
      },
    });
    return !!row;
  }

  async schoolAdminHasAny(
    adminId: string,
    alternatives: { resource: PermissionResource; type: PermissionType }[],
  ): Promise<boolean> {
    for (const alt of alternatives) {
      if (await this.schoolAdminHasPermission(adminId, alt.resource, alt.type)) {
        return true;
      }
    }
    return false;
  }
}
