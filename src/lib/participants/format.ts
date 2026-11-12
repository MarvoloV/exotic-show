// Keep aggregate NUMERIC values as decimal strings, never IEEE-754 numbers.
// No currency was specified; deliberately display only the recorded amount.
export function formatAmount(value: string): string {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Monto inválido.");
  const [integer, fraction = ""] = value.split(".");
  return `${integer}.${fraction.padEnd(2, "0")}`;
}
