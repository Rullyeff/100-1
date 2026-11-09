/** Formats a vote count: 12 -> "12 Suara". */
export function fmt(v: number): string {
  return `${Math.max(0, Math.round(v))} Suara`;
}
