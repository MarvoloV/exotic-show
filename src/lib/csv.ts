// Quote every cell; CSV quoting alone does not stop spreadsheet formulas.
export function csvCell(value: string): string {
  const safe = /^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
