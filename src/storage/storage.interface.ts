/**
 * Common interface for all storage drivers.
 * Every driver (Cloudinary, S3/Garage) must implement this contract so callers
 * remain completely unaware of which backend is active.
 */
export interface IStorageService {
  /**
   * Upload an image file. Drivers are responsible for resizing / optimising
   * before persisting so callers never need to touch image processing.
   *
   * @param file     - Multer in-memory file
   * @param folder   - Logical folder / prefix (e.g. 'schools/123/logo')
   * @param publicId - Optional deterministic name (without extension)
   * @returns Publicly accessible URL and a driver-specific key used for deletion
   */
  uploadImage(
    file: Express.Multer.File,
    folder: string,
    publicId?: string,
  ): Promise<{ url: string; publicId: string }>;

  /**
   * Delete a previously uploaded image.
   * @param publicId - The `publicId` value returned by `uploadImage`
   */
  deleteImage(publicId: string): Promise<void>;

  /**
   * Upload a raw document (PDF, DOCX, XLSX, …).
   * Validation of allowed extensions / MIME types / magic bytes is performed
   * inside the driver so the contract is identical for all backends.
   *
   * @param file     - Multer in-memory file
   * @param folder   - Logical folder / prefix
   * @param publicId - Optional deterministic name (without extension)
   * @returns Publicly accessible URL and a driver-specific key used for deletion
   */
  uploadRawFile(
    file: Express.Multer.File,
    folder: string,
    publicId?: string,
  ): Promise<{ url: string; publicId: string }>;

  /**
   * Delete a previously uploaded raw file.
   * @param publicId - The `publicId` value returned by `uploadRawFile`
   */
  deleteRawFile(publicId: string): Promise<void>;

  /**
   * Extract the driver-specific key / publicId from a stored URL so that
   * services that only have the URL (persisted in the DB) can still delete.
   *
   * @param url - The URL previously returned by upload*
   * @returns   - The `publicId` to pass to delete*, or `null` if unparseable
   */
  extractPublicId(url: string): string | null;
}

/** DI injection token — use this everywhere instead of a concrete class */
export const STORAGE_SERVICE = 'STORAGE_SERVICE';
