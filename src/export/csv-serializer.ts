import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface CsvRow {
  [column: string]: string | number | boolean | null | undefined;
}

/**
 * Serialises tabular data to a UTF-8 BOM-prefixed CSV buffer.
 *
 * Uses exceljs for RFC 4180-compliant field escaping (wraps fields containing
 * commas, double-quotes, or newlines; doubles embedded double-quotes).
 * Prepends the three BOM bytes 0xEF 0xBB 0xBF so Excel opens the file with
 * the correct UTF-8 encoding without manual encoding selection.
 */
@Injectable()
export class CsvSerializer {
  /**
   * Serialises rows to a UTF-8 BOM CSV Buffer.
   *
   * @param columns Ordered array of column names — becomes the header row.
   * @param rows    Data rows; each object's keys should match `columns`.
   *                Missing keys are serialised as empty cells.
   * @returns       A `Buffer` beginning with the UTF-8 BOM followed by the
   *                RFC 4180 CSV content. Returns a header-only CSV when
   *                `rows` is empty.
   */
  async serialize(columns: string[], rows: CsvRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Export');

    // Map each column name to an exceljs column definition.
    // The `header` drives the first row; `key` maps CsvRow property names.
    sheet.columns = columns.map((col) => ({ header: col, key: col }));

    // Add each data row using the column key mapping.
    for (const row of rows) {
      sheet.addRow(row);
    }

    // writeBuffer() returns the raw CSV bytes as a Buffer.
    const rawBuffer = (await workbook.csv.writeBuffer()) as unknown as Buffer;

    // Prepend UTF-8 BOM (required for correct Excel rendering of UTF-8 CSV).
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    return Buffer.concat([bom, rawBuffer]);
  }
}
