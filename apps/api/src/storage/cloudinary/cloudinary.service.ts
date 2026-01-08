import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

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
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn('Cloudinary credentials not configured. Image uploads will fail.');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  /**
   * Upload image to Cloudinary
   * @param file - Multer file object
   * @param folder - Folder path in Cloudinary (e.g., 'schools/logos', 'staff/profiles', 'students/profiles')
   * @param publicId - Optional public ID for the image
   * @returns Cloudinary upload result with secure URL
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    publicId?: string
  ): Promise<{ url: string; publicId: string }> {
    // Validate file buffer exists
    if (!file || !file.buffer) {
      throw new Error('File buffer is not available. Ensure FileInterceptor is configured with memoryStorage.');
    }

    // Validate Cloudinary is configured
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
    }

    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      };

      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        }
      );

      // Convert buffer to stream
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      bufferStream.pipe(uploadStream);
    });
  }

  /**
   * Delete image from Cloudinary
   * @param publicId - Public ID of the image to delete
   * @returns Deletion result
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Error deleting image from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Upload raw file (PDF, DOCX, etc.) to Cloudinary
   * @param file - Multer file object
   * @param folder - Folder path in Cloudinary (e.g., 'schools/class-resources', 'students/personal-resources')
   * @param publicId - Optional public ID for the file
   * @returns Cloudinary upload result with secure URL
   */
  async uploadRawFile(
    file: Express.Multer.File,
    folder: string,
    publicId?: string
  ): Promise<{ url: string; publicId: string }> {
    // Validate file buffer exists
    if (!file || !file.buffer) {
      throw new Error('File buffer is not available. Ensure FileInterceptor is configured with memoryStorage.');
    }

    // Validate file type for security - prevent malicious file uploads
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const mimeType = file.mimetype?.toLowerCase();

    if (!fileExtension || !ALLOWED_RAW_EXTENSIONS.includes(fileExtension)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${ALLOWED_RAW_EXTENSIONS.join(', ')}`
      );
    }

    if (!mimeType || !ALLOWED_RAW_MIMETYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid file MIME type. Please upload a valid document file.`
      );
    }

    // Validate Cloudinary is configured
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
    }

    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        folder,
        resource_type: 'raw', // Use 'raw' for non-image files
        use_filename: false,
        unique_filename: true,
      };

      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        }
      );

      // Convert buffer to stream
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      bufferStream.pipe(uploadStream);
    });
  }

  /**
   * Delete raw file from Cloudinary
   * @param publicId - Public ID of the file to delete
   * @returns Deletion result
   */
  async deleteRawFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   * @param url - Cloudinary URL
   * @returns Public ID or null
   */
  extractPublicId(url: string): string | null {
    if (!url) return null;
    
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
    // or: https://res.cloudinary.com/{cloud_name}/raw/upload/{version}/{public_id}.{format}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    return match ? match[1] : null;
  }
}

