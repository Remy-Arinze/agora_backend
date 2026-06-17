/**
 * CloudinaryService — backward-compatibility shim.
 *
 * All existing service files inject `CloudinaryService` by name.  Rather than
 * updating every call-site, this class simply delegates every method to the
 * active STORAGE_SERVICE provider so the correct driver (Cloudinary or S3) is
 * used transparently.
 *
 * New code should inject `STORAGE_SERVICE` (IStorageService) directly.
 */
import { Injectable, Inject } from '@nestjs/common';
import { IStorageService, STORAGE_SERVICE } from '../storage.interface';

@Injectable()
export class CloudinaryService implements IStorageService {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  uploadImage(
    file: Express.Multer.File,
    folder: string,
    publicId?: string,
  ): Promise<{ url: string; publicId: string }> {
    return this.storage.uploadImage(file, folder, publicId);
  }

  deleteImage(publicId: string): Promise<void> {
    return this.storage.deleteImage(publicId);
  }

  uploadRawFile(
    file: Express.Multer.File,
    folder: string,
    publicId?: string,
  ): Promise<{ url: string; publicId: string }> {
    return this.storage.uploadRawFile(file, folder, publicId);
  }

  deleteRawFile(publicId: string): Promise<void> {
    return this.storage.deleteRawFile(publicId);
  }

  extractPublicId(url: string): string | null {
    return this.storage.extractPublicId(url);
  }
}
