import { Logger } from '@nestjs/common';

// pdf-parse v1.x exports the parser function directly as module.exports.
// Using require() here to avoid TypeScript ESM interop issues.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

export class DocumentExtractor {
  private static readonly logger = new Logger(DocumentExtractor.name);

  /**
   * Extract text from a remote PDF file via its URL.
   * @param url Public URL to the PDF document
   * @returns Extracted plain text content
   */
  static async extractTextFromPdfUrl(url: string): Promise<string> {
    try {
      this.logger.log(`Fetching document for text extraction from: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Basic security check: 20MB max file size
      const MAX_SIZE_BYTES = 20 * 1024 * 1024;
      if (buffer.length > MAX_SIZE_BYTES) {
        throw new Error('Document exceeds maximum size limit of 20MB.');
      }

      // pdf-parse v1.1.1: pdfParse IS the function (module.exports = pdf)
      const data = await pdfParse(buffer);

      this.logger.log(`Extracted text successfully from ${url} (${data.numpages || 'unknown'} pages)`);

      return data.text;
    } catch (error) {
      this.logger.error(`Error during text extraction: ${error.message}`);
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  /**
   * Sanitizes and prepares extracted text for LLM consumption.
   * Truncates or cleans up noise if necessary.
   */
  static prepareTextForLLM(text: string, maxChars: number = 60000): string {
    // Remove control characters
    let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    if (cleaned.length > maxChars) {
      this.logger.warn(`Document text length ${cleaned.length} exceeds limit. Truncating to ${maxChars}.`);
      return cleaned.substring(0, maxChars);
    }

    return cleaned;
  }
}
