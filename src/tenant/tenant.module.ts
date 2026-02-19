import { Module } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';
import { TenantService } from './tenant.service';

@Module({
  providers: [TenantMiddleware, TenantService],
  exports: [TenantMiddleware, TenantService],
})
export class TenantModule {}
