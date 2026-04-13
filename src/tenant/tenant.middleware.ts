import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * JWT-Only Tenant Middleware
 * 
 * Extracts the schoolId (UUID) directly from the JWT payload.
 * This is the SOLE source of truth for tenant context on authenticated routes.
 * Unauthenticated routes (auth, public, swagger) are skipped entirely.
 * No subdomain logic. No database lookups. No caching.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  async use(req: any, res: Response, next: NextFunction) {
    const path = req.path;
    const url = req.url;
    const originalUrl = req.originalUrl || url;

    // Skip tenant resolution for routes that don't need it
    const isAuthRoute = path.startsWith('/auth') || url.startsWith('/auth') || originalUrl.startsWith('/auth');
    const isSuperAdminRoute = path.startsWith('/super-admin') || url.startsWith('/super-admin') || originalUrl.startsWith('/super-admin');
    const isSwaggerRoute = path.startsWith('/swagger') || path === '/api' || url.startsWith('/swagger') || url === '/api' || originalUrl.startsWith('/swagger') || originalUrl === '/api';
    const isPublicRoute = path.startsWith('/public') || url.startsWith('/public') || originalUrl.startsWith('/public') || originalUrl.includes('/public/');

    if (isAuthRoute || isSuperAdminRoute || isSwaggerRoute || isPublicRoute) {
      return next();
    }

    // Extract tenant context from JWT (the only source of truth)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const parts = token.split('.');

        if (parts.length === 3) {
          const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payloadString = Buffer.from(base64Payload, 'base64').toString();
          const payload = JSON.parse(payloadString);

          if (payload && payload.schoolId) {
            req.tenantId = payload.schoolId;
            req.headers['x-tenant-id'] = payload.schoolId;
          }
        }
      } catch (error) {
        this.logger.debug(`Failed to decode tenant from JWT: ${error.message}`);
      }
    }

    // Always proceed — the JwtAuthGuard will reject truly unauthorized requests.
    // Routes that are guarded will have req.user.currentSchoolId set by JwtStrategy.
    next();
  }
}
