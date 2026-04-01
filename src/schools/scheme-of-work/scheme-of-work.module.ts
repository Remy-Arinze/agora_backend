import { Module } from '@nestjs/common';
import { SchemeOfWorkController } from './scheme-of-work.controller';
import { SchemeOfWorkService } from './scheme-of-work.service';
import { DatabaseModule } from '../../database/database.module';
import { AiModule } from '../../ai/ai.module';

@Module({
  imports: [DatabaseModule, AiModule],
  controllers: [SchemeOfWorkController],
  providers: [SchemeOfWorkService],
  exports: [SchemeOfWorkService],
})
export class SchemeOfWorkModule {}
