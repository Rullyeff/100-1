import { AREA_COUNT, AREA_STOCK, BOARD_SIZE, MAX_ROUNDS, PENT_LAPS, TILES, startId } from "./board";

/** ring = Jalur Luar, gate = Gerbang Demokrasi, pent = Pentagon, done = finished the required laps. */
export type Phase = "ring" | "gate" | "pent" | "done";

export interface Player {
  id: number;
  name: string;
  isBot: boolean;
  /** Votes in hand. */
  cash: number;
  /** Physical token origins, retained across transfers. */
  votes: number[];
  areaTokens: boolean[];
  eligibility: number;
  missionFailures: number;
  progress: number;
  gateFinished: boolean;
  dormant: boolean;
  dormantTurns: number;
  hadVotes: boolean;
  skipTurns: number;
  protection: "back" | "skip" | "surprise" | null;
  retry: boolean;
  pos: number;
  phase: Phase;
  /** Completed Pentagon laps. */
  laps: number;
  /** Has five Area Tokens and meets vote eligibility; enters next turn. */
  ready: boolean;
  /** Earned another throw this turn. */
  extraRoll: boolean;
  /** Blocks the next Putusan Rakyat sanction. */
  shield: boolean;
  /** Eliminated (gugur). */
  bankrupt: boolean;
  /** Seat left empty by the bot setup: never takes a turn, votes or ranks. */
  absent?: boolean;
  /** Bot play style (offline setup); undefined plays the classic balanced way. */
  style?: BotStyle;
}

export type BotLevel = "mudah" | "sedang" | "sulit";
export type BotStyle = "hemat" | "seimbang" | "agresif";
export interface BotSetup {
  /** Number of bot opponents (1..4); seats after them stay empty. */
  opponents: number;
  level: BotLevel;
  /** Style per bot seat 1..4. */
  styles: BotStyle[];
  /**
   * Explicit five-seat lineup from the practice lobby: every seat plays, each is a
   * person on this device or a bot. When set, `opponents` and `humanCount` are ignored.
   */
  seats?: SeatSetup[];
}
export interface SeatSetup {
  name: string;
  bot: boolean;
}

export interface GameState {
  /** Offline bot difficulty; undefined keeps the classic per-bot accuracy. */
  botLevel?: BotLevel;
  players: Player[];
  /** Owner player index per tile, -1 = none (Pentagon plots only). */
  owners: number[];
  /** Building level per tile for the 3D city (1 = claimed plot), -1 = none. */
  levels: number[];
  /** Votes pledged on each tile. */
  invested: number[];
  plotVotes: number[][];
  decks: Record<string, number[]>;
  winnerId: number | null;
  openingRolls: number[];
  openingShown: boolean;
  /** Current owner of each area's Gerbang Aman (homebase). */
  homeOwner: number[];
  /** Undistributed vote tokens per area. */
  stock: number[];
  /** Pentagon laps every player must reach before the votes are counted. */
  lapGoal: number;
  turn: number;
  round: number;
  turnsInRound: number;
  maxRounds: number;
  over: boolean;
  /** Mulberry32 seed state. */
  rng: number;
  lastDice: number;
}

/** Seat order follows the arms clockwise; seat k plays area k. */
export const PLAYER_NAMES = ["Kamu", "Joko", "Budi", "Sari", "Rina"];

export function createGame(seed = Date.now() >>> 0, humanCount = 1, setup?: BotSetup): GameState {
  const s: GameState = {
    players: PLAYER_NAMES.map((name, id) => ({
      id,
      name,
      isBot: id >= humanCount,
      cash: 0,
      votes: new Array(AREA_COUNT).fill(0),
      areaTokens: new Array(AREA_COUNT).fill(false),
      eligibility: 0,
      missionFailures: 0,
      progress: 0,
      gateFinished: false,
      dormant: false,
      dormantTurns: 0,
      hadVotes: false,
      skipTurns: 0,
      protection: null,
      retry: false,
      pos: startId(id),
      phase: "ring",
      laps: 0,
      ready: false,
      extraRoll: false,
      shield: false,
      bankrupt: false,
    })),
    owners: new Array(BOARD_SIZE).fill(-1),
    levels: new Array(BOARD_SIZE).fill(-1),
    invested: new Array(BOARD_SIZE).fill(0),
    plotVotes: Array.from({ length: BOARD_SIZE }, () => new Array(AREA_COUNT).fill(0)),
    decks: {},
    winnerId: null,
    openingRolls: [],
    openingShown: false,
    homeOwner: Array.from({ length: AREA_COUNT }, (_, i) => i),
    stock: new Array(AREA_COUNT).fill(AREA_STOCK),
    lapGoal: PENT_LAPS,
    turn: 0,
    round: 1,
    turnsInRound: 0,
    maxRounds: MAX_ROUNDS,
    over: false,
    rng: seed || 1,
    lastDice: 1,
  };
  if (setup?.seats) {
    s.botLevel = setup.level;
    let botIndex = 0;
    s.players.forEach((p) => {
      const seat = setup.seats![p.id];
      if (!seat) return;
      p.name = seat.name.trim().slice(0, 24) || p.name;
      p.isBot = seat.bot;
      if (p.isBot) p.style = setup.styles[botIndex++] ?? "seimbang";
    });
  } else if (setup) {
    s.botLevel = setup.level;
    const seats = humanCount + Math.max(1, Math.min(PLAYER_NAMES.length - humanCount, setup.opponents));
    s.players.forEach((p) => {
      if (p.id >= seats) { p.absent = true; p.phase = "done"; }
      else if (p.isBot) p.style = setup.styles[p.id - humanCount] ?? "seimbang";
    });
  }
  let candidates = s.players.filter((p) => !p.absent).map((p) => p.id);
  while (candidates.length > 1) {
    const rolls = candidates.map((id) => ({ id, die: rollDie(s) }));
    rolls.forEach(({ id, die }) => {
      s.openingRolls[id] = die;
    });
    const high = Math.max(...rolls.map((r) => r.die));
    candidates = rolls.filter((r) => r.die === high).map((r) => r.id);
  }
  s.turn = candidates[0] ?? 0;
  return s;
}

/** Deterministic random in [0, 1); advances the state's seed. */
export function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** One six-sided die (the rulebook uses a single die). */
export function rollDie(s: GameState): number {
  return 1 + Math.floor(rand(s) * 6);
}

export function plotsOf(s: GameState, player: number): number[] {
  const out: number[] = [];
  s.owners.forEach((o, i) => o === player && TILES[i]?.kind === "plot" && out.push(i));
  return out;
}

export function pledgedVotes(s: GameState, player: number): number {
  return plotsOf(s, player).reduce((sum, t) => sum + (s.invested[t] ?? 0), 0);
}

/** Suara sah: votes in hand + votes pledged on plots still owned. */
export function validVotes(s: GameState, player: number): number {
  const p = s.players[player];
  return p ? p.cash + pledgedVotes(s, player) : 0;
}

/** @deprecated name kept for older UI code; same as validVotes. */
export const totalAssets = validVotes;

/** Player indices ordered by valid votes, most first (eliminated last). */
export function ranking(s: GameState): number[] {
  return s.players
    .map((p) => p.id)
    .sort(
      (a, b) =>
        Number(!!s.players[a]!.absent) - Number(!!s.players[b]!.absent) ||
        validVotes(s, b) - validVotes(s, a) ||
        (a === s.winnerId ? -1 : b === s.winnerId ? 1 : a - b),
    );
}

export function alivePlayers(s: GameState): number[] {
  return s.players.filter((p) => !p.bankrupt && !p.absent).map((p) => p.id);
}

/** Sum of every vote token on the table (always 100). */
export function votesInPlay(s: GameState): number {
  const hands = s.players.reduce((sum, p) => sum + p.cash, 0);
  const pledged = s.invested.reduce((sum, v) => sum + v, 0);
  const stock = s.stock.reduce((sum, v) => sum + v, 0);
  return hands + pledged + stock;
}
