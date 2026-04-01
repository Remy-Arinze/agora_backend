import { Module } from '@nestjs/common';
import { AgoraCurriculumController } from './agora-curriculum.controller';
import { AgoraCurriculumService } from './agora-curriculum.service';

import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';
import { CloudinaryModule } from '../storage/cloudinary/cloudinary.module';

@Module({
  imports: [DatabaseModule, AiModule, CloudinaryModule],
  controllers: [AgoraCurriculumController],
  providers: [AgoraCurriculumService],
  exports: [AgoraCurriculumService],
})
export class AgoraCurriculumModule {}
