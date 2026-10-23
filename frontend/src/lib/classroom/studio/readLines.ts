/** Parse teacher input without ever putting NaN or null in a draft. */
export function parseReadLines(text: string, max: number): { lines: number[]; error?: string } {
  const tokens = text.split(",").map((s) => s.trim()).filter(Boolean);
  const lines = tokens.map(Number);
  if (tokens.some((s) => !/^[0-9]+$/.test(s)) ||
      lines.some((n) => !Number.isSafeInteger(n) || n < 1 || n > max) ||
      new Set(lines).size !== lines.length || lines.length > 500)
    return { lines: [], error: `Use unique whole line numbers from 1 to ${max}, separated by commas (up to 500).` };
  return { lines };
}
