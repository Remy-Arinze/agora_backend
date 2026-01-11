import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchoolRepository } from '../schools/domain/repositories/school.repository';
import { IdGeneratorService } from '../schools/shared/id-generator.service';
import { AuthService } from '../auth/auth.service';
import { AddStudentDto } from '../schools/dto/add-student.dto';
import { TermStatus, SessionStatus } from '@prisma/client';
import { generateSecurePasswordHash } from '../common/utils/password.utils';

@Injectable()
export class StudentAdmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolRepository: SchoolRepository,
    private readonly idGenerator: IdGeneratorService,
    private readonly authService: AuthService
  ) {}

  /**
   * Add a student to a school
   * Checks if student email exists globally (not just in school)
   * If exists, throws error suggesting transfer
   * If new, creates student account and sends email with public ID
   */
  async addStudent(schoolId: string, studentData: AddStudentDto): Promise<any> {
    // Validate school exists
    const school = await this.schoolRepository.findByIdOrSubdomain(schoolId);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // Check if student email exists globally (in entire Agora system)
    if (studentData.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: studentData.email },
        include: {
          studentProfile: true,
        },
      });

      if (existingUser && existingUser.studentProfile) {
        // Student already exists in Agora system
        throw new ConflictException(
          `A student with email ${studentData.email} already exists in the Agora system. ` +
            `Please initiate a transfer instead of creating a new admission.`
        );
      }
    }

    // Validate required fields
    if (!studentData.firstName || !studentData.lastName || !studentData.dateOfBirth) {
      throw new BadRequestException('First name, last name, and date of birth are required');
    }

    if (!studentData.parentName || !studentData.parentPhone) {
      throw new BadRequestException('Parent/Guardian name and phone are required');
    }

    const defaultPassword = await generateSecurePasswordHash();

    // Generate student ID and public ID
    const studentUid = await this.idGenerator.generateStudentId();
    const publicId = await this.idGenerator.generatePublicId(school.name, 'student');

    // Determine academic year if not provided
    const academicYear = studentData.academicYear || this.getCurrentAcademicYear();

    // Create user, student, parent, and enrollment in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      try {
        // Find or create parent record (no User account needed)
        // Check if parent already exists by phone
        let parentProfile = await tx.parent.findFirst({
          where: { phone: studentData.parentPhone },
        });

        if (!parentProfile) {
          // Create parent profile without User account
          parentProfile = await tx.parent.create({
            data: {
              firstName: studentData.parentName.split(' ')[0] || studentData.parentName,
              lastName: studentData.parentName.split(' ').slice(1).join(' ') || '',
              phone: studentData.parentPhone,
              email: studentData.parentEmail || null,
              relationship: studentData.parentRelationship,
              userId: null, // No User account for parents
            },
          });
        }

        // Create student user
        const studentUser = await tx.user.create({
          data: {
            email: studentData.email || null,
            phone: studentData.phone,
            passwordHash: defaultPassword,
            accountStatus: 'SHADOW', // User needs to activate via email
            role: 'STUDENT',
          },
        });

        // Create student profile
        const newStudent = await tx.student.create({
          data: {
            uid: studentUid,
            publicId: publicId,
            firstName: studentData.firstName,
            middleName: studentData.middleName || null,
            lastName: studentData.lastName,
            dateOfBirth: new Date(studentData.dateOfBirth),
            profileImage: studentData.profileImage || null,
            userId: studentUser.id,
          },
          include: {
            user: true,
          },
        });

        // Link parent to student
        await tx.studentGuardian.create({
          data: {
            studentId: newStudent.id,
            parentId: parentProfile.id,
            relationship: studentData.parentRelationship,
            isPrimary: true,
          },
        });

        // Find active term to link enrollment to
        const activeTerm = await tx.term.findFirst({
          where: {
            status: TermStatus.ACTIVE,
            academicSession: {
              schoolId: school.id,
              status: SessionStatus.ACTIVE,
            },
          },
          orderBy: {
            number: 'desc',
          },
        });

        // Handle ClassArm enrollment (for PRIMARY/SECONDARY schools using ClassArms)
        let enrollmentClassLevel = studentData.classLevel;
        let enrollmentClassArmId: string | null = null;
        let enrollmentClassId: string | null = null;

        if (studentData.classArmId) {
          // Validate ClassArm exists and belongs to school
          const classArm = await tx.classArm.findUnique({
            where: { id: studentData.classArmId },
            include: {
              classLevel: true,
            },
          });

          if (!classArm || classArm.classLevel.schoolId !== school.id) {
            throw new BadRequestException('ClassArm not found or does not belong to this school');
          }

          // Validate capacity if set
          if (classArm.capacity !== null) {
            const currentEnrollments = await tx.enrollment.count({
              where: {
                classArmId: classArm.id,
                isActive: true,
                academicYear,
              },
            });

            if (currentEnrollments >= classArm.capacity) {
              throw new BadRequestException(
                `ClassArm "${classArm.name}" is at full capacity (${classArm.capacity} students)`
              );
            }
          }

          enrollmentClassArmId = classArm.id;
          enrollmentClassLevel = classArm.classLevel.name; // Auto-populate from ClassArm's ClassLevel
        } else if (studentData.classLevel) {
          // Fallback to Class (for schools without ClassArms or TERTIARY - backward compatibility)
          // Try to find a matching Class
          const matchingClass = await tx.class.findFirst({
            where: {
              schoolId: school.id,
              academicYear: academicYear,
              OR: [{ name: studentData.classLevel }, { classLevel: studentData.classLevel }],
              isActive: true,
            },
          });

          if (matchingClass) {
            enrollmentClassId = matchingClass.id;
          }
          // If no matching class found, enrollment will be created with just classLevel (backward compatibility)
        } else {
          throw new BadRequestException('Either classArmId or classLevel must be provided');
        }

        // Create enrollment with term link
        await tx.enrollment.create({
          data: {
            studentId: newStudent.id,
            schoolId: school.id,
            classArmId: enrollmentClassArmId,
            classId: enrollmentClassId,
            classLevel: enrollmentClassLevel,
            academicYear: academicYear,
            isActive: true,
            termId: activeTerm?.id || null, // Link to active term if exists
          },
        });

        return { student: newStudent, user: studentUser, publicId };
      } catch (error: any) {
        if (error.code === 'P2002') {
          const target = error.meta?.target;
          if (Array.isArray(target) && target.includes('email')) {
            throw new ConflictException(`User with email ${studentData.email} already exists`);
          }
          if (Array.isArray(target) && target.includes('phone')) {
            throw new ConflictException(
              `User with phone number ${studentData.phone} already exists`
            );
          }
          if (Array.isArray(target) && target.includes('publicId')) {
            throw new ConflictException('Public ID conflict. Please try again.');
          }
        }
        throw error;
      }
    });

    // Send password reset email with public ID (outside transaction)
    if (studentData.email) {
      try {
        await this.authService.sendPasswordResetForNewUser(
          result.user.id,
          studentData.email,
          `${studentData.firstName} ${studentData.lastName}`,
          'Student',
          result.publicId,
          school.name
        );
      } catch (error) {
        console.error('Failed to send password reset email to student:', error);
        // Don't throw - student is created, email failure is non-critical
      }
    }

    return {
      id: result.student.id,
      uid: result.student.uid,
      publicId: result.publicId,
      firstName: result.student.firstName,
      lastName: result.student.lastName,
      email: result.user.email,
      message: studentData.email
        ? 'Student created successfully. An email with login credentials has been sent.'
        : 'Student created successfully. Please provide the student with their Public ID for login.',
    };
  }

  /**
   * Get current academic year in format YYYY/YYYY+1
   */
  private getCurrentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    // If we're past September, it's the new academic year
    if (now.getMonth() >= 8) {
      return `${year}/${year + 1}`;
    }
    return `${year - 1}/${year}`;
  }
}
