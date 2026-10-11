/** CSV helpers for the ops exports (spreadsheet formula injection neutralised, as in the exams export). */

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((cols) => cols.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const csvFilename = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
