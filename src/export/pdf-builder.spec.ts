import * as fc from 'fast-check';
import { PdfBuilder } from './pdf-builder';
import { getFcNumRuns } from '../common/test/test-utils';

/**
 * Property 3: PDF Non-Empty Buffer
 * Validates: Requirements 6.2, 7.2, 8.2, 11.2
 */
describe('PdfBuilder — Property 3: PDF Non-Empty Buffer', () => {
  jest.setTimeout(15_000);

  const pdfBuilder = new PdfBuilder();

  it('always returns a non-empty Buffer starting with %PDF magic bytes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0),
          exportTimestamp: fc.date({
            min: new Date('2000-01-01T00:00:00.000Z'),
            max: new Date('2035-12-31T00:00:00.000Z'),
          }),
        }),
        async (options) => {
          const result = await pdfBuilder.build(options, (doc) => {
            doc.text('test');
          });

          // Must be a Buffer
          expect(Buffer.isBuffer(result)).toBe(true);

          // Must be non-empty
          expect(result.length).toBeGreaterThan(0);

          // Must start with %PDF magic bytes: 0x25 0x50 0x44 0x46
          expect(result[0]).toBe(0x25); // %
          expect(result[1]).toBe(0x50); // P
          expect(result[2]).toBe(0x44); // D
          expect(result[3]).toBe(0x46); // F
        },
      ),
      { numRuns: getFcNumRuns() },
    );
  });
});
