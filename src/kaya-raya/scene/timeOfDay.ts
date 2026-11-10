import { create } from "zustand";

export type Phase = "day" | "dusk" | "night";
export type PhaseChoice = Phase | "auto";

/** Rounds each phase lasts when the cycle runs automatically. */
export const ROUNDS_PER_PHASE = 2;
const CYCLE: Phase[] = ["day", "dusk", "night"];

export function phaseForRound(round: number): Phase {
  const i = Math.floor(Math.max(0, round - 1) / ROUNDS_PER_PHASE) % CYCLE.length;
  return CYCLE[i]!;
}

/** Lighting per phase. night = 0..1 drives window glow, headlights and street lamps. */
export const LOOK: Record<Phase, { sun: number; sunColor: string; sunPos: [number, number, number]; hemi: number; spot: number; env: number; exposure: number; sky: [number, number, number]; bg: string; night: number }> = {
  day: { sun: 2.6, sunColor: "#fff1dc", sunPos: [9, 18, 5], hemi: 0.55, spot: 1.2, env: 1, exposure: 1, sky: [2.6, 2.9, 3.4], bg: "#8fa9c4", night: 0 },
  dusk: { sun: 2.1, sunColor: "#ff9a55", sunPos: [16, 5, 3], hemi: 0.3, spot: 1.6, env: 0.75, exposure: 0.95, sky: [2.2, 1.3, 1.0], bg: "#4a2b2a", night: 0.55 },
  night: { sun: 0.55, sunColor: "#9db4ff", sunPos: [-8, 16, -6], hemi: 0.16, spot: 2.2, env: 0.45, exposure: 0.9, sky: [1, 1, 1], bg: "#0e0c0f", night: 1 },
};

export const PHASE_LABEL: Record<PhaseChoice, string> = { auto: "Otomatis", day: "Siang", dusk: "Senja", night: "Malam" };

export const useTimeOfDay = create<{ choice: PhaseChoice; cycle: () => void }>((set, get) => ({
  choice: "auto",
  cycle: () => {
    const order: PhaseChoice[] = ["auto", "day", "dusk", "night"];
    set({ choice: order[(order.indexOf(get().choice) + 1) % order.length]! });
  },
}));

/** Live, eased night factor shared with scene pieces (written once per frame by the lighting rig). */
export const ambience = { night: 1, sky: [1, 1, 1] as number[] };
