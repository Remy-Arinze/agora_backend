import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PortalsService } from './portals.service';
import { PortalsController } from './portals.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PortalsController],
  providers: [PortalsService],
  exports: [PortalsService],
})
export class PortalsModule {}
