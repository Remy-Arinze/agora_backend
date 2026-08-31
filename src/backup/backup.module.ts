import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { LoggerModule } from '../common/logger/logger.module';
import { ExportModule } from '../export/export.module';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { EncryptionService } from './encryption.service';

@Module({
  imports: [DatabaseModule, LoggerModule, ExportModule, ConfigModule],
  controllers: [BackupController],
  providers: [BackupService, EncryptionService],
  exports: [BackupService, EncryptionService],
})
export class BackupModule {}
