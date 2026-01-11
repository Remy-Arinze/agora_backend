import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
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
}
