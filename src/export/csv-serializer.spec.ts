import * as fc from 'fast-check';
import { parse } from 'csv-parse/sync';
import { CsvSerializer, CsvRow } from './csv-serializer';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Non-empty column name with no commas, double-quotes, or newline characters.
 * Keeping it simple ensures round-trip equality is unambiguous.
 */
const columnNameArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter((s) => !/[,"\n\r]/.test(s));

/**
 * Array of 1–8 unique column names.
 */
const uniqueColumnsArb = fc
  .array(columnNameArb, { minLength: 1, maxLength: 8 })
  .filter((cols) => new Set(cols).size === cols.length);

/**
 * Generates a single row object whose values are integers, keyed by the
 * provided column names.
 */
const rowArb = (columns: string[]): fc.Arbitrary<CsvRow> =>
  fc.record(
    Object.fromEntries(columns.map((col) => [col, fc.integer()])),
  ) as fc.Arbitrary<CsvRow>;

// ---------------------------------------------------------------------------
// Property 1 — CSV Round-Trip
// Validates: Requirements 1.6, 2.2, 11.4
// ---------------------------------------------------------------------------

describe('CsvSerializer — Property 1: CSV Round-Trip', () => {
  /**
   * For any valid set of columns and rows, serialising to CSV then parsing it
   * back must yield objects whose stringified values are identical to the
   * originals (round-trip property).
   *
   * **Validates: Requirements 1.6, 2.2, 11.4**
   */
  it('round-trips data through serialize → csv-parse', async () => {
    const serializer = new CsvSerializer();

    await fc.assert(
      fc.asyncProperty(
        uniqueColumnsArb.chain((columns) =>
          fc.tuple(
            fc.constant(columns),
            fc.array(rowArb(columns), { minLength: 0, maxLength: 20 }),
          ),
        ),
        async ([columns, rows]) => {
          const buf = await serializer.serialize(columns, rows);

          // Strip the 3 BOM bytes before handing to csv-parse
          const parsed: Record<string, string>[] = parse(buf.slice(3), {
            columns: true,
            skip_empty_lines: true,
          });

          // Row count must match
          expect(parsed.length).toBe(rows.length);

          // Every field must survive the round-trip
          for (let i = 0; i < rows.length; i++) {
            for (const col of columns) {
              const original = String(rows[i][col] ?? '');
              expect(parsed[i][col]).toBe(original);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 — CSV Header-Order
// Validates: Requirements 1.2, 2.2, 3.2, 4.2, 11.3
// ---------------------------------------------------------------------------

describe('CsvSerializer — Property 2: CSV Header-Order', () => {
  /**
   * The first line of the CSV (after stripping the BOM) must exactly match
   * the ordered array of column names supplied to serialize().
   *
   * **Validates: Requirements 1.2, 2.2, 3.2, 4.2, 11.3**
   */
  it('first CSV line matches the specified column order exactly', async () => {
    const serializer = new CsvSerializer();

    await fc.assert(
      fc.asyncProperty(uniqueColumnsArb, async (columns) => {
        const buf = await serializer.serialize(columns, []);

        // Decode and strip BOM character
        const csvText = buf.toString('utf8').replace(/^\uFEFF/, '');

        // First line is the header row
        const headerLine = csvText.split(/\r?\n/)[0];

        // Split on comma — column names contain no commas so this is safe
        const parsedHeaders = headerLine.split(',');

        expect(parsedHeaders).toEqual(columns);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5 — UTF-8 BOM Prefix
// Validates: Requirements 11.1
// ---------------------------------------------------------------------------

describe('CsvSerializer — Property 5: UTF-8 BOM Prefix', () => {
  /**
   * Every buffer returned by serialize() must begin with the three UTF-8 BOM
   * bytes 0xEF 0xBB 0xBF, regardless of column list or row content (including
   * the empty-rows case).
   *
   * **Validates: Requirements 11.1**
   */
  it('every output buffer starts with the UTF-8 BOM bytes', async () => {
    const serializer = new CsvSerializer();

    await fc.assert(
      fc.asyncProperty(
        uniqueColumnsArb,
        fc.boolean(), // true → include one data row; false → empty rows
        async (columns, includeRows) => {
          const rows: CsvRow[] = includeRows
            ? [Object.fromEntries(columns.map((col) => [col, 42]))]
            : [];

          const buf = await serializer.serialize(columns, rows);

          expect(buf[0]).toBe(0xef);
          expect(buf[1]).toBe(0xbb);
          expect(buf[2]).toBe(0xbf);
        },
      ),
      { numRuns: 100 },
    );
  });
});
