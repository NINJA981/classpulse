/**
 * A small CSV reader/writer for roster imports and credential exports.
 *
 * Not a full RFC 4180 parser, but it handles what spreadsheet exports actually produce:
 * quoted fields containing commas, newlines and escaped quotes, CRLF line endings and a UTF-8 BOM.
 */

function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  // Whatever is left when the text runs out is the last field of the last row.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((cell) => cell.trim() !== ''));
}

export interface ParsedCsv {
  headers: string[];
  records: Record<string, string>[];
}

/** Parses CSV text into row objects keyed by the (trimmed) header line. */
export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows = splitRows(text);
  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0]!.map((h) => h.trim());
  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });
  return { headers, records };
}

/** Lowercase and strip everything except letters and digits: "Roll No." → "rollno". */
export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

function escapeCell(value: string): string {
  // Values are written verbatim (passwords must survive byte-for-byte); quote only when needed.
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialises rows to CSV text (CRLF line endings, as spreadsheets expect). */
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsText(file);
  });
}
