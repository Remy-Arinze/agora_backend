import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ModuleRef } from '@nestjs/core';
import { ErrorsService, CreateErrorDto } from '../../operations/errors/errors.service';
import { ErrorSeverity } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private errorsService: ErrorsService | null = null;

  constructor(private readonly moduleRef: ModuleRef) {}

  private async getErrorsService(): Promise<ErrorsService | null> {
    if (!this.errorsService) {
      try {
        this.errorsService = this.moduleRef.get(ErrorsService, { strict: false });
      } catch (error) {
        // ErrorsService not available (module not loaded yet)
        return null;
      }
    }
    return this.errorsService;
  }

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || message;

        // Handle validation errors
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
        }

        // Include error details if available
        if (responseObj.error) {
          details = responseObj.error;
        }
      }
    } else if (exception instanceof Error) {
      // Handle Prisma errors
      if (exception.message.includes('Unknown field')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'A system configuration error occurred. Please contact support.';
        this.logger.error(`Prisma field error: ${exception.message}`, exception.stack);
      } else if (exception.message.includes('Unique constraint')) {
        status = HttpStatus.CONFLICT;
        message = 'This record already exists. Please use a different value.';
      } else if (exception.message.includes('Foreign key constraint')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference. The related record does not exist.';
      } else if (this.isEmailServiceError(exception)) {
        // Handle SMTP/email service errors
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          'Unable to send email at this time. The email service is temporarily unavailable. Please try again later or contact support if the issue persists.';
        this.logger.error(`Email service error: ${exception.message}`, exception.stack);
      } else {
        // Log unexpected errors
        this.logger.error(`Unexpected error: ${exception.message}`, exception.stack);
        message = 'An unexpected error occurred. Please try again later.';
      }
    }

    // Log the error
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined
    );

    // Capture error for monitoring (async, don't await to avoid blocking response)
    this.captureErrorForMonitoring(exception, request, status, message).catch((err) => {
      // Silently fail - error capture should never break the application
      this.logger.warn(`Failed to capture error for monitoring: ${err.message}`);
    });

    // Return user-friendly error response
    response.status(status).json({
      success: false,
      message,
      error: details || (status >= 500 ? 'Internal Server Error' : 'Bad Request'),
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /**
   * Capture error for monitoring and analysis
   */
  private async captureErrorForMonitoring(
    exception: unknown,
    request: Request,
    statusCode: number,
    message: string
  ): Promise<void> {
    try {
      const errorsService = await this.getErrorsService();
      if (!errorsService) {
        // ErrorsService not available yet, skip capture
        return;
      }

      // Extract schoolId from request
      let schoolId: string | undefined;
      const user = (request as any).user;
      if (user?.currentSchoolId) {
        schoolId = user.currentSchoolId;
      } else if ((request as any).tenantId) {
        schoolId = (request as any).tenantId;
      } else if (request.headers['x-tenant-id']) {
        schoolId = request.headers['x-tenant-id'] as string;
      }

      // Extract userId from request
      const userId = user?.id;

      // Determine error type
      let errorType = 'UnknownError';
      if (exception instanceof HttpException) {
        errorType = exception.constructor.name;
      } else if (exception instanceof Error) {
        errorType = exception.constructor.name;
      }

      // Determine severity
      let severity: ErrorSeverity = ErrorSeverity.LOW;
      if (statusCode >= 500) {
        severity = ErrorSeverity.HIGH;
      } else if (statusCode === 401 || statusCode === 403) {
        severity = ErrorSeverity.CRITICAL;
      } else if (statusCode >= 400) {
        severity = ErrorSeverity.MEDIUM;
      }

      // Get stack trace
      const stackTrace = exception instanceof Error ? exception.stack : undefined;

      // Build context
      const context: any = {
        method: request.method,
        path: request.path,
        query: request.query,
        ip: request.ip || request.headers['x-forwarded-for'] || 'unknown',
        userAgent: request.headers['user-agent'] || 'unknown',
      };

      // Include body for non-GET requests (sanitize sensitive data)
      if (request.method !== 'GET' && request.body) {
        const sanitizedBody = { ...request.body };
        // Remove sensitive fields
        if (sanitizedBody.password) delete sanitizedBody.password;
        if (sanitizedBody.passwordHash) delete sanitizedBody.passwordHash;
        if (sanitizedBody.token) delete sanitizedBody.token;
        context.body = sanitizedBody;
      }

      // Capture error
      await errorsService.captureError({
        errorType,
        message,
        stackTrace,
        context,
        severity,
        schoolId,
        userId,
      });
    } catch (error) {
      // Silently fail - don't break error handling
      this.logger.warn(`Error in captureErrorForMonitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if an error is related to email service (SMTP connection issues)
   * This is a fallback for errors that weren't caught at the controller level
   */
  private isEmailServiceError(error: Error): boolean {
    const errorAny = error as any;

    // Check for network connection errors
    if (
      errorAny.code === 'ETIMEDOUT' ||
      errorAny.code === 'ECONNREFUSED' ||
      errorAny.code === 'ENOTFOUND' ||
      errorAny.code === 'EHOSTUNREACH'
    ) {
      return true;
    }

    // Check for SMTP-specific errors in message
    if (
      error.message &&
      (error.message.includes('SMTP') ||
        error.message.includes('email service') ||
        error.message.includes('mail server') ||
        error.message.includes('connection timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT'))
    ) {
      return true;
    }

    return false;
  }
}
