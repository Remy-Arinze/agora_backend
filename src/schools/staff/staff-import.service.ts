import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminService } from './admins/admin.service';
import { TeacherService } from './teachers/teacher.service';
import { StaffBulkImportRowDto, StaffImportSummaryDto } from '../dto/staff-bulk-import.dto';
import { UserWithContext } from '../../auth/types/user-with-context.type';
import * as XLSX from 'xlsx';

import {
  sanitizeString,
  sanitizeOptionalString,
  sanitizeEmail,
  sanitizePhone,
} from '../../common/utils/sanitize.util';

@Injectable()
export class StaffImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
    private readonly teacherService: TeacherService,
  ) { }

  /**
   * Bulk import staff from CSV/Excel file
   * Reuses existing addTeacher and addAdmin methods to ensure consistency
   */
  async bulkImportStaff(
    schoolId: string,
    file: Express.Multer.File,
    requestingUser: UserWithContext,
    schoolType?: string
  ): Promise<StaffImportSummaryDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate file type
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
      throw new BadRequestException('Invalid file type. Please upload a CSV or Excel file.');
    }

    // Parse file
    let rows: StaffBulkImportRowDto[];
    try {
      if (fileExtension === 'csv') {
        // Parse CSV
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet);
      } else {
        // Parse Excel
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet);
      }
    } catch (error) {
      throw new BadRequestException(
        'Failed to parse file. Please ensure it is a valid CSV or Excel file.'
      );
    }

    if (rows.length === 0) {
      throw new BadRequestException('File is empty or contains no data rows.');
    }

    const summary: StaffImportSummaryDto = {
      totalRows: rows.length,
      successCount: 0,
      errorCount: 0,
      generatedPublicIds: [],
      errors: [],
    };

    // ... (in the bulk processing loop)

    // Helper function to safely convert any value to trimmed string
    const toTrimmedString = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    };

    // Helper to capitalize words
    const capitalizeWords = (str: string) => {
      if (!str) return str;
      return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    // For PRIMARY schools, fetch all active class arms for matching
    const activeClassArms = schoolType === 'PRIMARY'
      ? await this.prisma.classArm.findMany({
        where: { isActive: true, classLevel: { schoolId } },
        include: { classLevel: true },
      })
      : [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        const typeRaw = toTrimmedString(row.type).toLowerCase();
        const type = (typeRaw === 'teacher' || typeRaw === 'admin') ? typeRaw : undefined;

        // Sanitize and format
        const firstName = capitalizeWords(sanitizeString(toTrimmedString(row.firstName), 50));
        const lastName = capitalizeWords(sanitizeString(toTrimmedString(row.lastName), 50));
        const email = sanitizeEmail(toTrimmedString(row.email)) || toTrimmedString(row.email).toLowerCase();
        const phone = sanitizePhone(toTrimmedString(row.phone)) || toTrimmedString(row.phone);

        const role = sanitizeOptionalString(toTrimmedString(row.role), 100);
        const subject = sanitizeOptionalString(toTrimmedString(row.subject), 100);
        const employeeId = sanitizeOptionalString(toTrimmedString(row.employeeId), 50);

        if (!type || !firstName || !lastName || !email || !phone) {
          summary.errors.push({
            row: rowNumber,
            error: 'Missing required fields: type, firstName, lastName, email, or phone',
          });
          summary.errorCount++;
          continue;
        }

        if (type !== 'teacher' && type !== 'admin') {
          summary.errors.push({
            row: rowNumber,
            error: `Invalid type: "${type}". Must be "teacher" or "admin"`,
          });
          summary.errorCount++;
          continue;
        }

        if (type === 'admin' && !role) {
          summary.errors.push({
            row: rowNumber,
            error: 'Missing required field: role (required for admin type)',
          });
          summary.errorCount++;
          continue;
        }

        if (type === 'teacher') {
          try {
            let isTemporary = false;
            if (row.isTemporary != null && row.isTemporary !== '') {
              if (typeof row.isTemporary === 'boolean') isTemporary = row.isTemporary;
              else if (typeof row.isTemporary === 'string')
                isTemporary = row.isTemporary.trim().toLowerCase() === 'true';
              else isTemporary = Boolean(row.isTemporary);
            }

            let subjectIds: string[] = [];
            let classArmId: string | undefined;

            if (subject) {
              if (schoolType === 'PRIMARY') {
                // Heuristic match for Primary Class Arm
                const normalizedSubject = subject.toLowerCase().replace(/[\s_-]+/g, '');
                const matchedArm = activeClassArms.find(arm => {
                  const fullName = `${arm.classLevel.name}${arm.name}`.toLowerCase().replace(/[\s_-]+/g, '');
                  return fullName === normalizedSubject || arm.id === subject;
                });

                if (matchedArm) {
                  classArmId = matchedArm.id;
                }
              } else {
                // Support comma-separated subjects for SECONDARY/TERTIARY
                const subjectNames = subject.split(',').map((s: string) => s.trim()).filter(Boolean);
                if (subjectNames.length > 0) {
                  const dbSubjects = await this.prisma.subject.findMany({
                    where: {
                      schoolId,
                      name: { in: subjectNames, mode: 'insensitive' },
                      isActive: true,
                    },
                    select: { id: true, name: true },
                  });
                  subjectIds = dbSubjects.map((s: any) => s.id);

                  if (dbSubjects.length < subjectNames.length) {
                    const missing = subjectNames.filter((name: string) =>
                      !dbSubjects.some((sd: any) => sd.name.toLowerCase() === name.toLowerCase())
                    );
                    console.warn(`Row ${rowNumber}: Subjects not found: ${missing.join(', ')}`);
                  }
                }
              }
            }

            // Create the teacher (classArmId is passed in the DTO;
            // addTeacher handles the ClassTeacher assignment automatically)
            const result = await this.teacherService.addTeacher(schoolId, {
              firstName,
              lastName,
              email,
              phone,
              subject: subject || undefined,
              subjectIds: subjectIds.length > 0 ? subjectIds : undefined,
              employeeId: employeeId || undefined,
              isTemporary,
              schoolType,
              classArmId: classArmId || undefined,
            });

            summary.successCount++;
            const publicId = (result as any)?.publicId || (result as any)?.data?.publicId;
            if (publicId) summary.generatedPublicIds.push(publicId);
          } catch (error: any) {
            summary.errors.push({
              row: rowNumber,
              error: error.message || 'Failed to add teacher',
            });
            summary.errorCount++;
          }
        } else if (type === 'admin') {
          try {
            const result = await this.adminService.addAdmin(schoolId, {
              firstName,
              lastName,
              email,
              phone,
              role: role || '',
              schoolType,
            }, requestingUser);

            summary.successCount++;
            const publicId = (result as any)?.publicId || (result as any)?.data?.publicId;
            if (publicId) summary.generatedPublicIds.push(publicId);
          } catch (error: any) {
            summary.errors.push({
              row: rowNumber,
              error: error.message || 'Failed to add admin',
            });
            summary.errorCount++;
          }
        }
      } catch (error: any) {
        summary.errors.push({
          row: rowNumber,
          error: error.message || 'Unknown error',
        });
        summary.errorCount++;
      }
    }

    return summary;
  }
}
