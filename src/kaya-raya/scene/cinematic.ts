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

export function milestone(title: string, player: number | undefined, game: GameState) {
  if (player === undefined || !["KOTA BARU!", "AMBIL ALIH!", "MONOPOLI WARNA!", "LANDMARK!"].includes(title)) return null;
  const tile = game.players[player]?.pos;
  if (tile === undefined || TILES[tile]?.kind !== "city") return null;
  const group = TILES[tile]?.group;
  const tiles = title === "MONOPOLI WARNA!" ? TILES.filter((t) => t.kind === "city" && t.group === group).map((t) => t.id) : [tile];
  return tiles;
}