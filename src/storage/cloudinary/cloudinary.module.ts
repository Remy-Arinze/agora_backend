import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '../storage.module';
import { CloudinaryService } from './cloudinary.service';

/**
 * CloudinaryModule — kept for backward compatibility.
 *
 * Internally it now delegates to StorageModule which picks the correct driver
 * based on STORAGE_DRIVER env var.  All existing modules that import
 * CloudinaryModule continue to work unchanged.
 */
@Module({
  imports: [ConfigModule, StorageModule],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
