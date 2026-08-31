import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LoggerModule } from '../common/logger/logger.module';
import { CsvSerializer } from './csv-serializer';
import { PdfBuilder } from './pdf-builder';
import { ExportService } from './export.service';
import { SchoolExportController } from './school-export.controller';
import { StudentExportController } from './student-export.controller';

@Module({
  imports: [DatabaseModule, LoggerModule],
  controllers: [SchoolExportController, StudentExportController],
  providers: [CsvSerializer, PdfBuilder, ExportService],
  exports: [CsvSerializer, PdfBuilder, ExportService],
})
export class ExportModule {}
