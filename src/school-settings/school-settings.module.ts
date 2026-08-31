import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SchoolSettingsController } from './school-settings.controller';
import { SchoolSettingsService } from './school-settings.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SchoolSettingsController],
  providers: [SchoolSettingsService],
  exports: [SchoolSettingsService],
})
export class SchoolSettingsModule {}
