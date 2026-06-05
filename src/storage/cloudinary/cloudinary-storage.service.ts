import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { IStorageService } from '../storage.interface';

// Allowed file types for raw uploads (documents, spreadsheets, presentations)
const ALLOWED_RAW_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'rtf', 'odt', 'ods', 'odp',
];

const ALLOWED_RAW_MIMETYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
];

@Injectable()
export class CloudinaryStorageService implements IStorageService {
  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn('[Storage:Cloudinary] Credentials not configured. Uploads will fail.');
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  }

  // ─── private helpers ────────────────────────────────────────────────────────

  private assertConfigured(): void {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }
  }

  // ─── IStorageService ────────────────────────────────────────────────────────

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    publicId?: string,
  ): Promise<{ url: string; publicId: string }> {
    if (!file?.buffer) {
      throw new Error('File buffer is not available. Ensure FileInterceptor uses memoryStorage.');
    }
    this.assertConfigured();

    return new Promise((resolve, reject) => {
      const opts: Record<string, unknown> = {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
      };
      if (publicId) opts.public_id = publicId;

      const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error('Upload failed: no result returned'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      });

      const readable = new Readable();
      readable.push(file.buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error('[Storage:Cloudinary] Error deleting image:', err);
      throw err;
    }
  }

  async uploadRawFile(
    file: Express.Multer.File,
    folder: string,
    publicId?: string,
  ): Promise<{ url: string; publicId: string }> {
    if (!file?.buffer) {
      throw new Error('File buffer is not available. Ensure FileInterceptor uses memoryStorage.');
    }

    // Extension + MIME validation
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const mime = file.mimetype?.toLowerCase();

    if (!ext || !ALLOWED_RAW_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${ALLOWED_RAW_EXTENSIONS.join(', ')}`,
      );
    }
    if (!mime || !ALLOWED_RAW_MIMETYPES.includes(mime)) {
      throw new BadRequestException('Invalid file MIME type. Please upload a valid document file.');
    }

    // Magic-number check (file-type is ESM-only, dynamic import required)
    const { fileTypeFromBuffer } = await (eval('import("file-type")') as Promise<any>);
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_RAW_MIMETYPES.includes(detected.mime.toLowerCase())) {
      throw new BadRequestException(
        `File signature mismatch. The content does not match .${ext?.toUpperCase()}. Possible malicious upload.`,
      );
    }

    this.assertConfigured();

    return new Promise((resolve, reject) => {
      const opts: Record<string, unknown> = {
        folder,
        resource_type: 'raw',
        use_filename: false,
        unique_filename: true,
      };
      if (publicId) opts.public_id = publicId;

      const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error('Upload failed: no result returned'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      });

      const readable = new Readable();
      readable.push(file.buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  }

  async deleteRawFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch (err) {
      console.error('[Storage:Cloudinary] Error deleting raw file:', err);
      throw err;
    }
  }

  /**
   * Parse the public_id from a Cloudinary URL.
   * Format: https://res.cloudinary.com/{cloud}/image/upload/v123/{public_id}.ext
   *      or https://res.cloudinary.com/{cloud}/raw/upload/v123/{public_id}.ext
   */
  extractPublicId(url: string): string | null {
    if (!url) return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    return match ? match[1] : null;
  }
}
