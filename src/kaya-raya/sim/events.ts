import { TILES } from "./board";
import type { GameState } from "./state";

export type BoardEventKind = "flood" | "festival" | "boom";
export interface BoardEvent { kind: BoardEventKind; group: number; startsRound: number; endsRound: number }
export const EVENT_RULES = {
  flood: { name: "Banjir", multiplier: 0.5, impact: "Sewa −50%" },
  festival: { name: "Festival Kota", multiplier: 1.5, impact: "Sewa +50%" },
  boom: { name: "Ledakan Ekonomi", multiplier: 2, impact: "Sewa ×2" },
} as const;

/** Separate deterministic schedule: event selection never consumes dice RNG. */
export function eventForRound(round: number): BoardEvent | null {
  if ((round - 1) % 3 === 2) return null;
  const cycle = Math.floor((round - 1) / 3);
  const kind = (["festival", "flood", "boom"] as const)[cycle % 3] ?? "festival";
  const startsRound = cycle * 3 + 1;
  return { kind, group: (cycle * 3 + 2) % 8, startsRound, endsRound: startsRound + 1 };
}

export function activeBoardEvent(game: GameState, tile?: number) {
  const event = game.boardEvent;
  if (!event || game.round < event.startsRound || game.round > event.endsRound) return null;
  if (tile !== undefined && (TILES[tile]?.kind !== "city" || TILES[tile]?.group !== event.group)) return null;
  return event;
}

export function eventTollMultiplier(game: GameState, tile: number) {
  const event = activeBoardEvent(game, tile);
  return event ? EVENT_RULES[event.kind].multiplier : 1;
}

export function affectedCities(event: BoardEvent) {
  return TILES.filter((tile) => tile.kind === "city" && tile.group === event.group);
}