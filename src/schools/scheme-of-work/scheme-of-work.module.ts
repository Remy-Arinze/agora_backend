import { Module } from '@nestjs/common';
import { SchemeOfWorkController } from './scheme-of-work.controller';
import { SchemeOfWorkService } from './scheme-of-work.service';
import { DatabaseModule } from '../../database/database.module';
import { AiModule } from '../../ai/ai.module';
import { CloudinaryModule } from '../../storage/cloudinary/cloudinary.module';
import { SchoolSettingsModule } from '../../school-settings/school-settings.module';

@Module({
  imports: [DatabaseModule, AiModule, CloudinaryModule, SchoolSettingsModule],
  controllers: [SchemeOfWorkController],
  providers: [SchemeOfWorkService],
  exports: [SchemeOfWorkService],
})
export class SchemeOfWorkModule {}
