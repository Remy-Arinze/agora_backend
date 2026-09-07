import { inflateRawSync } from 'zlib';
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
   * Extract plain text from a remote DOCX (Office Open XML) via its URL.
   */
  static async extractTextFromDocxUrl(url: string): Promise<string> {
    try {
      this.logger.log(`Fetching DOCX for text extraction from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const MAX_SIZE_BYTES = 20 * 1024 * 1024;
      if (buffer.length > MAX_SIZE_BYTES) {
        throw new Error('Document exceeds maximum size limit of 20MB.');
      }
      const xml = this.readZipEntry(buffer, 'word/document.xml');
      if (!xml) {
        throw new Error('DOCX is missing word/document.xml');
      }
      const text = xml
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+\n/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
      this.logger.log(`Extracted DOCX text successfully from ${url} (${text.length} chars)`);
      return text;
    } catch (error) {
      this.logger.error(`Error during DOCX extraction: ${error.message}`);
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  static async extractTextFromUrl(url: string, fileType?: string | null): Promise<string> {
    const type = (fileType || '').toUpperCase();
    if (type === 'PDF' || url.toLowerCase().includes('.pdf')) {
      return this.extractTextFromPdfUrl(url);
    }
    if (type === 'DOCX' || type === 'DOC' || url.toLowerCase().includes('.docx')) {
      return this.extractTextFromDocxUrl(url);
    }
    throw new Error(`Unsupported document type for extraction: ${fileType || 'unknown'}`);
  }

  private static readZipEntry(buffer: Buffer, entryName: string): string | null {
    let offset = 0;
    while (offset + 30 <= buffer.length) {
      if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
      const method = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const name = buffer.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
      const dataStart = offset + 30 + nameLen + extraLen;
      const dataEnd = dataStart + compSize;
      if (name === entryName) {
        const raw = buffer.slice(dataStart, dataEnd);
        const inflated = method === 0 ? raw : inflateRawSync(raw);
        return inflated.toString('utf8');
      }
      offset = dataEnd;
    }
    return null;
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
