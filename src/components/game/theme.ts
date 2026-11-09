import { GATE_LEN, PENT_TOTAL, type Phase, type Player } from "@/site/view";

export const AREA_BG = ["bg-area-0", "bg-area-1", "bg-area-2", "bg-area-3", "bg-area-4"];
export const AREA_TEXT = ["text-area-0", "text-area-1", "text-area-2", "text-area-3", "text-area-4"];
export const AREA_BORDER = ["border-area-0", "border-area-1", "border-area-2", "border-area-3", "border-area-4"];
export const areaVar = (a: number) => `var(--area-${a})`;

export const PHASE_LABEL: Record<Phase, string> = {
  outer: "Jalur Luar",
  gate: "Gerbang Demokrasi",
  pentagon: "Pentagon",
  done: "Selesai",
  out: "Gugur",
};

export function phaseDetail(p: Player) {
  if (p.phase === "outer") return p.outerPos < 0 ? "di START" : `petak L${p.outerPos + 1}`;
  if (p.phase === "gate") return `Gerbang ${p.gatePos}/${GATE_LEN}`;
  if (p.phase === "pentagon") return `Putaran ${p.pentRound} · ${p.pentSteps}/${PENT_TOTAL} langkah`;
  if (p.phase === "out") return "tidak lanjut bermain";
  return "dua putaran tuntas";
}

export const LETTERS = ["A", "B", "C", "D", "E"];
