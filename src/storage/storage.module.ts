import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE } from './storage.interface';
import { CloudinaryStorageService } from './cloudinary/cloudinary-storage.service';
import { S3StorageService } from './s3/s3-storage.service';

/**
 * StorageModule — driver-agnostic file-storage abstraction.
 *
 * Set  STORAGE_DRIVER=s3         to use Garage / any S3-compatible backend.
 * Set  STORAGE_DRIVER=cloudinary  (or omit) to keep the existing Cloudinary behaviour.
 *
 * All consumers should inject the STORAGE_SERVICE token rather than a concrete class:
 *
 *   @Inject(STORAGE_SERVICE) private readonly storage: IStorageService
 *
 * The legacy CloudinaryService alias (src/storage/cloudinary/cloudinary.service.ts)
 * re-exports this same provider so existing service files continue to work without
 * any changes.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_SERVICE,
      useFactory: (config: ConfigService) => {
        const driver = (config.get<string>('STORAGE_DRIVER') ?? 'cloudinary').toLowerCase();

        if (driver === 's3') {
          return new S3StorageService(config);
        }

        // Default — Cloudinary
        return new CloudinaryStorageService(config);
      },
      inject: [ConfigService],
    },
    // Also register the concrete classes so they can be injected by name if ever needed
    CloudinaryStorageService,
    S3StorageService,
  ],
  exports: [STORAGE_SERVICE, CloudinaryStorageService, S3StorageService],
})
export class StorageModule {}
