// Board data: 32 tiles, Start at index 0, moving clockwise around the board.
// Money is stored in thousands ("K"): 200 means 200K.

export type TileKind = "start" | "city" | "chance" | "tax" | "bonus" | "island" | "worldcup" | "travel";

export interface Tile {
  id: number;
  kind: TileKind;
  name: string;
  /** Land price in K (cities only). */
  price: number;
  /** Colour group for cities (index into GROUP_COLORS). */
  group: number;
}

export const BOARD_SIZE = 32;
export const ISLAND_INDEX = 8;
export const WORLDCUP_INDEX = 16;
export const TRAVEL_INDEX = 24;

/** Salary paid each time a player passes or lands on Start. */
export const SALARY = 200;
export const START_CASH = 2000;
export const MAX_ROUNDS = 30;
/** Turns a player stays stuck on the Deserted Island unless they roll doubles. */
export const ISLAND_TURNS = 3;

/** Build cost multipliers (x land price) to reach each level. 0 = land, 1-3 houses, 4 = landmark. */
export const BUILD_COST = [1, 0.5, 1, 1.5, 2];
/** Toll multipliers (x land price) per level. */
export const TOLL_MULT = [0.25, 0.8, 2, 3.5, 6];
/** Takeover price as a multiple of everything invested in the city. */
export const TAKEOVER_MULT = 2;
/** Share of the invested value returned when a property is force-sold. */
export const SELL_RATE = 0.5;

export const LEVEL_NAMES = ["Tanah", "Rumah", "Gedung", "Hotel", "Landmark"];

const c = (name: string, price: number, group: number) => ({ kind: "city" as const, name, price, group });
const s = (kind: TileKind, name: string) => ({ kind, name, price: 0, group: -1 });

const RAW = [
  s("start", "START"),
  c("Bangkok", 50, 0),
  c("Beijing", 60, 0),
  s("chance", "Kesempatan"),
  c("Taipei", 80, 1),
  c("New Delhi", 90, 1),
  s("bonus", "Bonus"),
  c("Seoul", 100, 1),
  s("island", "Pulau Terpencil"),
  c("Jakarta", 120, 2),
  c("Bali", 130, 2),
  s("chance", "Kesempatan"),
  c("Kuala Lumpur", 150, 3),
  c("Singapura", 160, 3),
  s("tax", "Pajak"),
  c("Tokyo", 180, 3),
  s("worldcup", "Piala Dunia"),
  c("Sydney", 200, 4),
  c("Sao Paulo", 210, 4),
  s("chance", "Kesempatan"),
  c("Berlin", 230, 5),
  c("Roma", 240, 5),
  s("bonus", "Bonus"),
  c("Paris", 260, 5),
  s("travel", "Keliling Dunia"),
  c("London", 280, 6),
  c("Madrid", 290, 6),
  s("chance", "Kesempatan"),
  c("Los Angeles", 320, 7),
  s("tax", "Pajak"),
  c("Dubai", 350, 7),
  c("New York", 400, 7),
];

export const TILES: Tile[] = RAW.map((t, id) => ({ id, ...t }));

/** Hex colours for the eight city groups (used by the 3D board). */
export const GROUP_COLORS = [
  "#f28c28", // orange
  "#e84a5f", // red
  "#3cb371", // green
  "#2fa4d8", // sky blue
  "#f4c430", // yellow
  "#d65db1", // pink
  "#8a5cd6", // violet
  "#1f6fd1", // deep blue
];
