import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { IStorageService } from '../storage.interface';

// ─── allowed raw file types ─────────────────────────────────────────────────
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

// ─── image processing config ────────────────────────────────────────────────
/**
 * Profile / logo images: resize so the longest edge is at most 1200 px,
 * convert to webp, and compress.  This mirrors Cloudinary's auto-quality /
 * auto-format transformation used in the Cloudinary driver.
 */
const IMAGE_MAX_DIMENSION = 1200;
const IMAGE_WEBP_QUALITY = 82; // 0-100; 82 is visually lossless for most photos

@Injectable()
export class S3StorageService implements IStorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION') ?? 'us-east-1';
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY') ?? '';

    this.bucket = this.configService.get<string>('S3_BUCKET') ?? '';
    this.publicBaseUrl = (
      this.configService.get<string>('S3_PUBLIC_BASE_URL') ?? ''
    ).replace(/\/$/, ''); // strip trailing slash

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.logger.warn(
        '[Storage:S3] One or more required env vars are missing ' +
          '(S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET). Uploads will fail.',
      );
    }

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      // Required for path-style URLs used by Garage and most self-hosted S3
      forcePathStyle: true,
    });
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  /**
   * Build a deterministic S3 object key from a logical folder and a name.
   * Keys use forward-slash separators and are safe for HTTP URLs.
   */
  private buildKey(folder: string, name: string, ext: string): string {
    const safeFolder = folder.replace(/^\/|\/$/g, ''); // strip leading/trailing slashes
    return `${safeFolder}/${name}.${ext}`;
  }

  /**
   * Convert the stored public URL back to the S3 object key so we can delete.
   *
   * If S3_PUBLIC_BASE_URL is set the key is everything after {base}/{bucket}/
   * or after {base}/ depending on whether the bucket name is in the path.
   * Falls back to stripping the endpoint prefix.
   */
  extractPublicId(url: string): string | null {
    if (!url) return null;

    // Try to strip the known public base URL prefix
    if (this.publicBaseUrl && url.startsWith(this.publicBaseUrl)) {
      // URL shape: {publicBaseUrl}/{key}  OR  {publicBaseUrl}/{bucket}/{key}
      let path = url.slice(this.publicBaseUrl.length).replace(/^\//, '');
      // If the path starts with the bucket name, strip it too
      if (path.startsWith(`${this.bucket}/`)) {
        path = path.slice(this.bucket.length + 1);
      }
      return path || null;
    }

    // Fallback: parse as a URL and take the pathname
    try {
      const parsed = new URL(url);
      let key = parsed.pathname.replace(/^\//, '');
      // path-style: /{bucket}/{key}
      if (key.startsWith(`${this.bucket}/`)) {
        key = key.slice(this.bucket.length + 1);
      }
      return key || null;
    } catch {
      return null;
    }
  }

  /**
   * Build the public URL for a given S3 key.
   * Uses S3_PUBLIC_BASE_URL when set (e.g. a CDN or reverse-proxy URL).
   * Falls back to the path-style S3 endpoint URL.
   */
  private buildPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${this.bucket}/${key}`;
    }
    const endpoint = this.configService.get<string>('S3_ENDPOINT') ?? '';
    return `${endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
  }

  /**
   * Process an image buffer through sharp:
   *  - Resize so the longest edge ≤ IMAGE_MAX_DIMENSION (preserving aspect ratio)
   *  - Convert to WebP at IMAGE_WEBP_QUALITY
   * Returns the processed buffer.
   */
  private async processImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize({
        width: IMAGE_MAX_DIMENSION,
        height: IMAGE_MAX_DIMENSION,
        fit: 'inside',      // never upscale, never crop
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .toBuffer();
  }

  /** Upload a buffer to S3 and return the public URL + key */
  private async putObject(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: Readable.from(buffer),
        ContentType: contentType,
        // Make the object publicly readable so URLs work without presigning.
        // Remove / adjust this if you want private objects + signed URLs.
        ACL: 'public-read',
      },
    });

    await upload.done();
    return this.buildPublicUrl(key);
  }

  // ─── IStorageService ───────────────────────────────────────────────────────

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    publicId?: string,
  ): Promise<{ url: string; publicId: string }> {
    if (!file?.buffer) {
      throw new Error('File buffer is not available. Ensure FileInterceptor uses memoryStorage.');
    }

    // Process image: resize + convert to webp
    const processedBuffer = await this.processImage(file.buffer);
    const name = publicId ?? uuidv4();
    const key = this.buildKey(folder, name, 'webp');

    const url = await this.putObject(key, processedBuffer, 'image/webp');

    this.logger.debug(`[Storage:S3] Uploaded image → ${key}`);
    return { url, publicId: key };
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: publicId }),
      );
      this.logger.debug(`[Storage:S3] Deleted image → ${publicId}`);
    } catch (err) {
      this.logger.error(`[Storage:S3] Error deleting image ${publicId}:`, err);
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

    // Magic-number check
    const { fileTypeFromBuffer } = await (eval('import("file-type")') as Promise<any>);
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_RAW_MIMETYPES.includes(detected.mime.toLowerCase())) {
      throw new BadRequestException(
        `File signature mismatch. The content does not match .${ext?.toUpperCase()}. Possible malicious upload.`,
      );
    }

    const name = publicId ?? uuidv4();
    const key = this.buildKey(folder, name, ext);

    const url = await this.putObject(key, file.buffer, mime);

    this.logger.debug(`[Storage:S3] Uploaded raw file → ${key}`);
    return { url, publicId: key };
  }

  async deleteRawFile(publicId: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: publicId }),
      );
      this.logger.debug(`[Storage:S3] Deleted raw file → ${publicId}`);
    } catch (err) {
      this.logger.error(`[Storage:S3] Error deleting raw file ${publicId}:`, err);
      throw err;
    }
  }
}
