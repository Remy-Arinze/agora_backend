import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Get the request path (could be /auth/login or /api/auth/login depending on setup)
    const path = req.path;
    const url = req.url;
    
    // Skip tenant validation for auth routes (login, verify-otp, etc.)
    // These routes don't require tenant context since user isn't authenticated yet
    // Check both path and url to handle different NestJS configurations
    const isAuthRoute = 
      path.startsWith('/auth') || 
      path.startsWith('/api/auth') ||
      url.startsWith('/auth') ||
      url.startsWith('/api/auth');
    
    // Skip tenant validation for super admin routes
    const isSuperAdminRoute = 
      path.startsWith('/super-admin') || 
      path.startsWith('/api/super-admin') ||
      url.startsWith('/super-admin') ||
      url.startsWith('/api/super-admin');
    
    // Skip tenant validation for swagger/docs routes
    const isSwaggerRoute = 
      path.startsWith('/swagger') || 
      path.startsWith('/api/swagger') ||
      url.startsWith('/swagger') ||
      url.startsWith('/api/swagger');

    // Skip tenant validation for public routes (landing page data)
    const isPublicRoute = 
      path.startsWith('/public') || 
      path.startsWith('/api/public') ||
      url.startsWith('/public') ||
      url.startsWith('/api/public');

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
      // Skip tenant validation for localhost, 127.0.0.1, and common development hosts
      const isLocalhost = 
        subdomain === 'localhost' || 
        subdomain === '127.0.0.1' ||
        host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        subdomain === 'api';
      
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

