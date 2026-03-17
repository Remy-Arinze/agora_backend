import * as validator from 'validator';

/** Strip HTML tags (e.g. to prevent stored XSS) */
const STRIP_HTML_REGEX = /<[^>]*>/g;

/** Remove control characters (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F) */
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Sanitize a plain-text string: strip HTML, control chars, trim, enforce max length.
 * Use for names, addresses, notes, etc. Safe to store and later render in HTML when escaped.
 */
export function sanitizeString(value: string | null | undefined, maxLength: number): string;
export function sanitizeString(
  value: string | null | undefined,
  maxLength: number,
  optional: true
): string | undefined;
export function sanitizeString(
  value: string | null | undefined,
  maxLength: number,
  optional?: boolean
): string | undefined {
  if (value == null) return optional ? undefined : '';
  if (typeof value !== 'string') return optional ? undefined : '';
  const trimmed = value.trim();
  if (optional && trimmed === '') return undefined;
  const noControl = trimmed.replace(CONTROL_CHARS_REGEX, '');
  const noHtml = noControl.replace(STRIP_HTML_REGEX, '');
  const out = validator.trim(noHtml).substring(0, maxLength);
  return optional && out === '' ? undefined : out;
}

/**
 * Sanitize email: trim, lowercase, strip control chars and HTML.
 */
export function sanitizeEmail(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const noControl = trimmed.replace(CONTROL_CHARS_REGEX, '');
  const noHtml = noControl.replace(STRIP_HTML_REGEX, '');
  return validator
    .trim(validator.normalizeEmail(noHtml, { gmail_remove_subaddress: false }) || noHtml)
    .toLowerCase()
    .substring(0, 255) || undefined;
}

/**
 * Sanitize phone: digits and leading + only (E.164-friendly).
 */
export function sanitizePhone(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^\d+]/g, '');
  if (cleaned === '') return undefined;
  return cleaned.substring(0, 20);
}

/**
 * Sanitize optional string (returns undefined when empty after sanitization).
 */
export function sanitizeOptionalString(
  value: string | null | undefined,
  maxLength: number
): string | undefined {
  return sanitizeString(value, maxLength, true);
}
