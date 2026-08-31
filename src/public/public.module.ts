import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { DatabaseModule } from '../database/database.module';
import { StudentsModule } from '../students/students.module';
import { SchoolSettingsModule } from '../school-settings/school-settings.module';

@Module({
  imports: [DatabaseModule, StudentsModule, SchoolSettingsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
