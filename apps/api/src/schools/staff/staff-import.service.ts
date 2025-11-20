import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminService } from './admins/admin.service';
import { TeacherService } from './teachers/teacher.service';
import { StaffBulkImportRowDto, StaffImportSummaryDto } from '../dto/staff-bulk-import.dto';
import * as XLSX from 'xlsx';

@Injectable()
export class StaffImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
    private readonly teacherService: TeacherService
  ) {}

  /**
   * Bulk import staff from CSV/Excel file
   * Reuses existing addTeacher and addAdmin methods to ensure consistency
   */
  async bulkImportStaff(
    schoolId: string,
    file: Express.Multer.File
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
      throw new BadRequestException('Failed to parse file. Please ensure it is a valid CSV or Excel file.');
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

    // Helper function to safely convert any value to trimmed string
    const toTrimmedString = (value: any): string => {
      if (value === null || value === undefined) return '';
      return String(value).trim();
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because Excel is 1-indexed and has header

      try {
        // Normalize all fields to strings (Excel may parse phone numbers as numbers)
        const type = toTrimmedString(row.type).toLowerCase();
        const firstName = toTrimmedString(row.firstName);
        const lastName = toTrimmedString(row.lastName);
        const email = toTrimmedString(row.email);
        const phone = toTrimmedString(row.phone);
        const role = toTrimmedString(row.role);
        const subject = toTrimmedString(row.subject);
        const employeeId = toTrimmedString(row.employeeId);

        // Validate required fields
        if (!type || !firstName || !lastName || !email || !phone) {
          summary.errors.push({
            row: rowNumber,
            error: 'Missing required fields: type, firstName, lastName, email, or phone',
          });
          summary.errorCount++;
          continue;
        }

        // Validate type
        if (type !== 'teacher' && type !== 'admin') {
          summary.errors.push({
            row: rowNumber,
            error: `Invalid type: "${type}". Must be "teacher" or "admin"`,
          });
          summary.errorCount++;
          continue;
        }

        // Validate admin-specific requirements
        if (type === 'admin' && !role) {
          summary.errors.push({
            row: rowNumber,
            error: 'Missing required field: role (required for admin type)',
          });
          summary.errorCount++;
          continue;
        }

        // Process based on type
        if (type === 'teacher') {
          try {
            // Safely convert isTemporary to boolean
            let isTemporary = false;
            if (row.isTemporary !== undefined && row.isTemporary !== null && row.isTemporary !== '') {
              if (typeof row.isTemporary === 'boolean') {
                isTemporary = row.isTemporary;
              } else if (typeof row.isTemporary === 'string') {
                isTemporary = row.isTemporary.trim().toLowerCase() === 'true';
              } else {
                isTemporary = Boolean(row.isTemporary);
              }
            }

            // Look up subject by name to get the ID for SubjectTeacher relationship
            let subjectIds: string[] | undefined;
            if (subject) {
              const foundSubject = await this.prisma.subject.findFirst({
                where: {
                  schoolId,
                  name: {
                    equals: subject,
                    mode: 'insensitive', // Case-insensitive match
                  },
                  isActive: true,
                },
                select: { id: true },
              });
              
              if (foundSubject) {
                subjectIds = [foundSubject.id];
              } else {
                // Log warning but continue - subject might be added later
                console.warn(`Subject "${subject}" not found for school ${schoolId}, row ${rowNumber}. Teacher will be created without subject assignment.`);
              }
            }

            const result = await this.teacherService.addTeacher(schoolId, {
              firstName,
              lastName,
              email,
              phone,
              subject: subject || undefined, // Keep legacy field for display
              subjectIds, // Pass subject IDs for SubjectTeacher creation
              employeeId: employeeId || undefined,
              isTemporary,
            });

            summary.successCount++;
            // Extract publicId from result (could be in result.publicId or result.teacher.publicId)
            const publicId = (result as any)?.publicId || (result as any)?.teacher?.publicId;
            if (publicId) {
              summary.generatedPublicIds.push(publicId);
            }
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
              role,
            });

            summary.successCount++;
            // Extract publicId from result (could be in result.publicId or result.admin.publicId)
            const publicId = (result as any)?.publicId || (result as any)?.admin?.publicId;
            if (publicId) {
              summary.generatedPublicIds.push(publicId);
            }
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

