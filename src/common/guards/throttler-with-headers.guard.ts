import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Request, Response } from 'express';

/**
 * Enhanced ThrottlerGuard that supports user-based rate limiting
 * 
 * Features:
 * - Uses user ID for authenticated users (more accurate than IP)
 * - Falls back to IP address for unauthenticated requests
 * - Handles proxy headers (X-Forwarded-For) correctly
 * 
 * Rate limit headers are added by ThrottlerHeadersInterceptor
 */
@Injectable()
export class ThrottlerWithHeadersGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storage: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storage, reflector);
  }

  /**
   * Generate a unique key for rate limiting
   * Uses user ID for authenticated users, IP address for unauthenticated
   * Overrides the base method to support user-based tracking
   */
  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { id?: string } | undefined;

    // For authenticated users, use user ID for more accurate tracking
    if (user?.id) {
      return `throttle:user:${user.id}:${suffix}:${name}`;
    }

    // For unauthenticated requests, use IP address
    const ip = this.getIpAddress(request);
    return `throttle:ip:${ip}:${suffix}:${name}`;
  }

  /**
   * Extract IP address from request
   * Handles proxies and load balancers (X-Forwarded-For header)
   */
  private getIpAddress(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  /**
   * Override to add rate limit headers when throttling exception is thrown
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: {
      limit: number;
      ttl: number;
      timeToExpire: number;
      key: string;
      tracker: string;
      totalHits: number;
    },
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    
    // Add rate limit headers before throwing exception
    this.addThrottleHeaders(response, throttlerLimitDetail);
    
    // Call parent to throw the exception
    super.throwThrottlingException(context, throttlerLimitDetail);
  }

  /**
   * Add rate limit headers when rate limit is exceeded (429 response)
   */
  private addThrottleHeaders(
    response: Response,
    limitDetail: {
      limit: number;
      ttl: number;
      timeToExpire: number;
    },
  ): void {
    const resetTime = Math.ceil(Date.now() / 1000) + Math.ceil(limitDetail.timeToExpire / 1000);
    const retryAfter = Math.ceil(limitDetail.timeToExpire / 1000);
    
    response.setHeader('X-RateLimit-Limit', limitDetail.limit.toString());
    response.setHeader('X-RateLimit-Remaining', '0');
    response.setHeader('X-RateLimit-Reset', resetTime.toString());
    response.setHeader('Retry-After', retryAfter.toString());
  }
}
