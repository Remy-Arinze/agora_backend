import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Get the request path (routes are now directly accessible without /api prefix)
    const path = req.path;
    const url = req.url;
    const originalUrl = req.originalUrl || url;

    // Skip tenant validation for auth routes (login, verify-otp, etc.)
    // These routes don't require tenant context since user isn't authenticated yet
    const isAuthRoute =
      path.startsWith('/auth') ||
      url.startsWith('/auth') ||
      originalUrl.startsWith('/auth');

    // Skip tenant validation for super admin routes
    const isSuperAdminRoute =
      path.startsWith('/super-admin') ||
      url.startsWith('/super-admin') ||
      originalUrl.startsWith('/super-admin');

    // Skip tenant validation for swagger/docs routes
    // /api is now the Swagger documentation endpoint
    const isSwaggerRoute =
      path.startsWith('/swagger') ||
      path === '/api' ||
      url.startsWith('/swagger') ||
      url === '/api' ||
      originalUrl.startsWith('/swagger') ||
      originalUrl === '/api' ||
      originalUrl.startsWith('/api/') && originalUrl.includes('swagger');

    // Skip tenant validation for public routes (landing page data)
    const isPublicRoute =
      path.startsWith('/public') ||
      url.startsWith('/public') ||
      originalUrl.startsWith('/public') ||
      originalUrl.includes('/public/');

    if (isAuthRoute || isSuperAdminRoute || isSwaggerRoute || isPublicRoute) {
      // Allow these routes to proceed without tenant validation
      return next();
    }

    // Extract tenant from header (set by frontend based on subdomain)
    const tenantId = req.headers['x-tenant-id'] as string;

    // Extract from host header as fallback
    const host = req.headers.host || '';
    const subdomain = host.split('.')[0];

    if (!tenantId) {
      // Try to resolve tenant from subdomain
      // Skip tenant validation for localhost, 127.0.0.1, Azure domains, and common development hosts
      const isLocalhost =
        subdomain === 'localhost' ||
        subdomain === '127.0.0.1' ||
        host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        subdomain === 'api' ||
        host.includes('azurewebsites.net'); // Skip Azure deployment domains

      if (isLocalhost) {
        // For localhost, allow requests without tenant (useful for development and super admin)
        // Tenant will be set later if needed based on user role
        return next();
      }

      if (subdomain) {
        const school = await this.tenantService.findSchoolBySubdomain(subdomain);
        if (school) {
          req.headers['x-tenant-id'] = school.id;
          (req as any).tenantId = school.id;
        } else {
          throw new BadRequestException('Invalid tenant subdomain');
        }
      } else {
        throw new BadRequestException('Tenant ID is required');
      }
    } else {
      // Attach tenant context to request
      (req as any).tenantId = tenantId;
    }

    next();
  }
}
