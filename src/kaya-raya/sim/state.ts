import { BOARD_SIZE, BUILD_COST, MAX_ROUNDS, SELL_RATE, START_CASH, TAKEOVER_MULT, TILES, TOLL_MULT } from "./board";
import { eventForRound, eventTollMultiplier, type BoardEvent } from "./events";

export interface Player {
  id: number;
  name: string;
  isBot: boolean;
  cash: number;
  pos: number;
  /** Remaining stuck turns on the island. */
  island: number;
  /** Next turn: choose any destination. */
  travel: boolean;
  /** Angel card: blocks the next toll. */
  shield: boolean;
  bankrupt: boolean;
}

export interface GameState {
  players: Player[];
  /** Owner player index per tile, -1 = none. */
  owners: number[];
  /** Building level per tile (0 land .. 4 landmark), -1 = no property. */
  levels: number[];
  /** Total K paid into each tile's land + buildings. */
  invested: number[];
  /** Tile hosting the World Cup festival (toll x2), -1 = none. */
  festival: number;
  boardEvent: BoardEvent | null;
  turn: number;
  round: number;
  maxRounds: number;
  over: boolean;
  /** Mulberry32 seed state. */
  rng: number;
  lastDice: [number, number];
}

export const PLAYER_NAMES = ["Kamu", "Budi", "Sari", "Joko"];

export function createGame(seed = Date.now() >>> 0, humanCount = 1): GameState {
  return {
    players: PLAYER_NAMES.map((name, id) => ({
      id,
      name,
      isBot: id >= humanCount,
      cash: START_CASH,
      pos: 0,
      island: 0,
      travel: false,
      shield: false,
      bankrupt: false,
    })),
    owners: new Array(BOARD_SIZE).fill(-1),
    levels: new Array(BOARD_SIZE).fill(-1),
    invested: new Array(BOARD_SIZE).fill(0),
    festival: -1,
    boardEvent: eventForRound(1),
    turn: 0,
    round: 1,
    maxRounds: MAX_ROUNDS,
    over: false,
    rng: seed || 1,
    lastDice: [1, 1],
  };
}

/** Deterministic random in [0, 1); advances the state's seed. */
export function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rollDice(s: GameState): [number, number] {
  return [1 + Math.floor(rand(s) * 6), 1 + Math.floor(rand(s) * 6)];
}

export function buildCost(tile: number, toLevel: number): number {
  return Math.round(TILES[tile]!.price * BUILD_COST[toLevel]!);
}

/** Cost to go from `fromLevel` (-1 = unowned) up to `toLevel` inclusive. */
export function upgradeCost(tile: number, fromLevel: number, toLevel: number): number {
  let total = 0;
  for (let l = fromLevel + 1; l <= toLevel; l++) total += buildCost(tile, l);
  return total;
}

export function tollOf(s: GameState, tile: number): number {
  const level = s.levels[tile]!;
  if (level < 0) return 0;
  return tollAtLevel(s, tile, level);
}

export function tollAtLevel(s: GameState, tile: number, level: number): number {
  const base = Math.round(TILES[tile]!.price * TOLL_MULT[level]!);
  return Math.round(base * (s.festival === tile ? 2 : 1) * eventTollMultiplier(s, tile));
}

export function takeoverPrice(s: GameState, tile: number): number {
  return Math.round(s.invested[tile]! * TAKEOVER_MULT);
}

export function sellValue(s: GameState, tile: number): number {
  return Math.floor(s.invested[tile]! * SELL_RATE);
}

export function propertiesOf(s: GameState, player: number): number[] {
  const out: number[] = [];
  s.owners.forEach((o, i) => o === player && out.push(i));
  return out;
}

export function propertyValue(s: GameState, player: number): number {
  return propertiesOf(s, player).reduce((sum, t) => sum + s.invested[t]!, 0);
}

export function totalAssets(s: GameState, player: number): number {
  const p = s.players[player]!;
  return p.bankrupt ? 0 : p.cash + propertyValue(s, player);
}

/** Player indices ordered by total assets, richest first (bankrupt last). */
export function ranking(s: GameState): number[] {
  return s.players
    .map((p) => p.id)
    .sort((a, b) => totalAssets(s, b) - totalAssets(s, a) || a - b);
}

export function alivePlayers(s: GameState): number[] {
  return s.players.filter((p) => !p.bankrupt).map((p) => p.id);
}

export function releaseProperty(s: GameState, tile: number) {
  s.owners[tile] = -1;
  s.levels[tile] = -1;
  s.invested[tile] = 0;
  if (s.festival === tile) s.festival = -1;
}
