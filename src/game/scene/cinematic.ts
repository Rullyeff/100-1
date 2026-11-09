import { create } from "zustand";
import { TILES } from "../sim/board";
import type { GameState } from "../sim/state";

export const CINEMATIC_SECONDS = 1.6;
export interface Cinematic { id: number; title: string; text: string; tiles: number[] }
export const useCinematic = create<{ event: Cinematic | null; show: (event: Cinematic) => void; skip: () => void }>((set) => ({
  event: null,
  show: (event) => set({ event }),
  skip: () => set({ event: null }),
}));

const MILESTONES = ["WILAYAH BARU!", "AMBIL ALIH!", "GERBANG DIREBUT!", "PENTAGON!"];

/** Tiles the camera should frame for a big banner, or null for ordinary banners. */
export function milestone(title: string, player: number | undefined, game: GameState) {
  if (player === undefined || !MILESTONES.includes(title)) return null;
  const tile = game.players[player]?.pos;
  if (tile === undefined) return null;
  const kind = TILES[tile]?.kind;
  if (kind !== "plot" && kind !== "home") return null;
  return [tile];
}
