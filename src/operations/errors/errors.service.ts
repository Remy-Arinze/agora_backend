import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ErrorSeverity, ErrorStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';

export interface ErrorContext {
  method?: string;
  path?: string;
  query?: any;
  body?: any;
  headers?: Record<string, string>;
  ip?: string;
  userAgent?: string;
  userId?: string;
  schoolId?: string;
}

export interface CreateErrorDto {
  errorType: string;
  message: string;
  stackTrace?: string;
  context?: ErrorContext;
  severity: ErrorSeverity;
  schoolId?: string;
  userId?: string;
}

export interface ErrorFilters {
  schoolId?: string;
  severity?: ErrorSeverity;
  status?: ErrorStatus;
  errorType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ErrorStats {
  total: number;
  bySeverity: Record<ErrorSeverity, number>;
  byStatus: Record<ErrorStatus, number>;
  recentTrends: Array<{ date: string; count: number }>;
  topErrorTypes: Array<{ errorType: string; count: number }>;
}

@Injectable()
export class ErrorsService {
  private readonly logger = new Logger(ErrorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique error ID
   */
  private generateErrorId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const hash = createHash('md5')
      .update(`${timestamp}-${random}`)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();
    return `ERR-${timestamp}-${hash}`;
  }

  /**
   * Determine error severity based on error type and status code
   */
  private determineSeverity(errorType: string, statusCode?: number): ErrorSeverity {
    // Critical errors
    if (
      errorType.includes('Security') ||
      errorType.includes('Unauthorized') ||
      errorType.includes('Forbidden') ||
      errorType.includes('DataCorruption')
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity - system/database errors
    if (
      errorType.includes('Prisma') ||
      errorType.includes('Database') ||
      errorType.includes('InternalServerError') ||
      statusCode === 500
    ) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity - business logic errors
    if (
      errorType.includes('BadRequest') ||
      errorType.includes('Conflict') ||
      errorType.includes('NotFound') ||
      (statusCode && statusCode >= 400 && statusCode < 500)
    ) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity - validation errors, user input issues
    return ErrorSeverity.LOW;
  }

  /**
   * Generate a hash for error grouping (similar errors grouped together)
   */
  private generateErrorHash(errorType: string, message: string): string {
    // Normalize message for grouping (remove dynamic values like IDs, timestamps)
    const normalizedMessage = message
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '[ID]')
      .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\b/g, '[TIMESTAMP]')
      .replace(/\b\d+\b/g, '[NUMBER]');

    return createHash('md5')
      .update(`${errorType}:${normalizedMessage}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Capture an error and store it in the database
   */
  async captureError(dto: CreateErrorDto): Promise<void> {
    try {
      const errorId = this.generateErrorId();
      const errorHash = this.generateErrorHash(dto.errorType, dto.message);
      const severity = dto.severity || this.determineSeverity(dto.errorType);

      // Check if a similar error already exists (same errorType + normalized message)
      const existingError = await this.prisma.applicationError.findFirst({
        where: {
          errorType: dto.errorType,
          message: {
            contains: dto.message.substring(0, 100), // Partial match for grouping
          },
          schoolId: dto.schoolId || null,
        },
        orderBy: {
          lastSeen: 'desc',
        },
      });

      if (existingError) {
        // Update existing error: increment occurrences, update lastSeen
        await this.prisma.applicationError.update({
          where: { id: existingError.id },
          data: {
            occurrences: { increment: 1 },
            lastSeen: new Date(),
            context: (dto.context || existingError.context) as Prisma.InputJsonValue, // Update context with latest
          },
        });
      } else {
        // Create new error record
        await this.prisma.applicationError.create({
          data: {
            errorId,
            errorType: dto.errorType,
            message: dto.message,
            stackTrace: dto.stackTrace,
            context: (dto.context || {}) as Prisma.InputJsonValue,
            severity,
            schoolId: dto.schoolId,
            userId: dto.userId,
            status: ErrorStatus.UNRESOLVED,
            occurrences: 1,
            firstSeen: new Date(),
            lastSeen: new Date(),
          },
        });
      }
    } catch (error) {
      // Don't throw - error logging should never break the application
      this.logger.error(`Failed to capture error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get errors for a specific school with filtering
   */
  async getErrorsBySchool(schoolId: string, filters: ErrorFilters = {}): Promise<{
    errors: any[];
    total: number;
  }> {
    const where: any = {
      schoolId,
    };

    if (filters.severity) {
      where.severity = filters.severity;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.errorType) {
      where.errorType = { contains: filters.errorType, mode: 'insensitive' };
    }

    if (filters.startDate || filters.endDate) {
      where.firstSeen = {};
      if (filters.startDate) {
        where.firstSeen.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.firstSeen.lte = filters.endDate;
      }
    }

    const [errors, total] = await Promise.all([
      this.prisma.applicationError.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          lastSeen: 'desc',
        },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.applicationError.count({ where }),
    ]);

    return { errors, total };
  }

  /**
   * Get error details by ID
   */
  async getErrorById(errorId: string): Promise<any> {
    return this.prisma.applicationError.findUnique({
      where: { errorId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Update error status
   */
  async updateErrorStatus(
    errorId: string,
    status: ErrorStatus,
    resolvedBy?: string
  ): Promise<any> {
    const updateData: any = {
      status,
    };

    if (status === ErrorStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = resolvedBy;
    }

    return this.prisma.applicationError.update({
      where: { errorId },
      data: updateData,
    });
  }

  /**
   * Get error statistics for a school
   */
  async getErrorStats(schoolId: string, days: number = 30): Promise<ErrorStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [total, errors] = await Promise.all([
      this.prisma.applicationError.count({
        where: { schoolId, firstSeen: { gte: startDate } },
      }),
      this.prisma.applicationError.findMany({
        where: {
          schoolId,
          firstSeen: { gte: startDate },
        },
        select: {
          severity: true,
          status: true,
          errorType: true,
          firstSeen: true,
        },
      }),
    ]);

    // Calculate by severity
    const bySeverity: Record<ErrorSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    // Calculate by status
    const byStatus: Record<ErrorStatus, number> = {
      UNRESOLVED: 0,
      INVESTIGATING: 0,
      RESOLVED: 0,
      IGNORED: 0,
    };

    // Count error types
    const errorTypeCounts: Record<string, number> = {};

    errors.forEach((error) => {
      bySeverity[error.severity]++;
      byStatus[error.status]++;
      errorTypeCounts[error.errorType] = (errorTypeCounts[error.errorType] || 0) + 1;
    });

    // Get top error types
    const topErrorTypes = Object.entries(errorTypeCounts)
      .map(([errorType, count]) => ({ errorType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate recent trends (last 7 days)
    const trends: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trends[dateStr] = 0;
    }

    errors.forEach((error) => {
      const dateStr = error.firstSeen.toISOString().split('T')[0];
      if (trends[dateStr] !== undefined) {
        trends[dateStr]++;
      }
    });

    const recentTrends = Object.entries(trends).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      total,
      bySeverity,
      byStatus,
      recentTrends,
      topErrorTypes,
    };
  }
}
