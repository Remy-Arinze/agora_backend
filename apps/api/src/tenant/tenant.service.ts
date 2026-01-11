import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findSchoolBySubdomain(subdomain: string) {
    return this.prisma.school.findUnique({
      where: { subdomain },
      select: {
        id: true,
        name: true,
        subdomain: true,
        isActive: true,
      },
    });
  }

  async getTenantId(request: any): Promise<string | null> {
    return request.tenantId || null;
  }
}
