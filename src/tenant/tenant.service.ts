import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the tenant ID (schoolId UUID) from the request.
   * This is set by TenantMiddleware from the JWT payload.
   */
  async getTenantId(request: any): Promise<string | null> {
    return request.tenantId || null;
  }
}
