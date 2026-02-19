import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { Reflector } from '@nestjs/core';
import { THROTTLER_OPTIONS } from '@nestjs/throttler/dist/throttler.constants';
import { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Interceptor that adds industry-standard rate limit headers to responses
 * Headers follow RFC 6585 and common industry practices:
 * - X-RateLimit-Limit: Maximum number of requests allowed
 * - X-RateLimit-Remaining: Number of requests remaining in current window (estimated)
 * - X-RateLimit-Reset: Unix timestamp when the rate limit resets
 * 
 * Note: Remaining count is estimated based on configuration.
 * For exact remaining counts, consider using Redis-based storage.
 */
@Injectable()
export class ThrottlerHeadersInterceptor implements NestInterceptor {
  constructor(
    @Inject(THROTTLER_OPTIONS)
    private readonly options: ThrottlerOptions[] | ThrottlerOptions,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        // Add rate limit headers after successful request
        this.addRateLimitHeaders(context, response);
      }),
    );
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(
    context: ExecutionContext,
    response: Response,
  ): void {
    try {
      const limitDetail = this.getLimitDetail(context);
      
      if (!limitDetail) {
        return;
      }

      const { limit, ttl } = limitDetail;
      
      // Calculate reset time (current time + TTL in seconds)
      const resetTime = Math.ceil(Date.now() / 1000) + Math.ceil(ttl / 1000);

      // Add headers
      // Note: Remaining count would require storage access, so we set it to a safe default
      // In production with Redis, you can query the actual remaining count
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', (limit - 1).toString()); // Conservative estimate
      response.setHeader('X-RateLimit-Reset', resetTime.toString());
    } catch (error) {
      // Silently fail - don't break the request if header addition fails
      // Log in development only
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to add rate limit headers:', error);
      }
    }
  }

  /**
   * Get limit detail from @Throttle decorator or use default
   */
  private getLimitDetail(context: ExecutionContext): { limit: number; ttl: number } | null {
    // Try to get from @Throttle decorator metadata
    const handler = context.getHandler();
    const throttleMetadata = this.reflector.get<{ limit: number; ttl: number }>(
      'THROTTLE',
      handler,
    );

    if (throttleMetadata) {
      return throttleMetadata;
    }

    // Fall back to default options
    const defaultOption = Array.isArray(this.options) ? this.options[0] : this.options;
    
    if (defaultOption) {
      // Handle Resolvable<number> types
      const limit = typeof defaultOption.limit === 'function' 
        ? defaultOption.limit(context) 
        : defaultOption.limit;
      const ttl = typeof defaultOption.ttl === 'function'
        ? defaultOption.ttl(context)
        : defaultOption.ttl;
      
      // If still a promise, resolve it (though this shouldn't happen in practice)
      const resolvedLimit = limit instanceof Promise ? 100 : limit;
      const resolvedTtl = ttl instanceof Promise ? 60000 : ttl;
      
      return {
        limit: resolvedLimit,
        ttl: resolvedTtl,
      };
    }

    return null;
  }

}
