/** Formats K amounts like the classic game: 350 -> "350K", 4514 -> "4M514". */
export function fmt(k: number): string {
  const v = Math.max(0, Math.round(k));
  if (v < 1000) return `${v}K`;
  const m = Math.floor(v / 1000);
  const rest = v % 1000;
  return rest === 0 ? `${m}M` : `${m}M${String(rest).padStart(3, "0")}`;
}
