// 100 SUARA board topology (pure data, no rendering).
// 5 areas, one per player. Each area has a 16-tile loop (START + 15 Jalur Luar tiles),
// a private 5-tile Gerbang Demokrasi lane, and a corner (Gerbang Aman / Homebase)
// on the shared 20-tile Pentagon.

export type TileKind =
  "start" | "aspirasi" | "demokrasi" | "kejutan" | "warga" | "gerbang" | "gate" | "home" | "plot";

export interface Tile {
  id: number;
  kind: TileKind;
  /** Short label printed on the tile. */
  name: string;
  /** Sub-label: difficulty, card category, etc. */
  sub: string;
  /** Owning area (0..4). Pentagon plots use the area of the corner they follow. */
  area: number;
}

export interface Area {
  key: string;
  name: string;
  /** Hex colour used by the 3D board (Three.js cannot parse CSS tokens). */
  color: string;
  /** Direction of the arm in degrees, counter-clockwise from screen-right (screen-up = 90). */
  angle: number;
}

/** Area k belongs to player k. Listed clockwise starting near the camera (bottom-left). */
export const AREAS: Area[] = [
  { key: "layanan", name: "Layanan Publik", color: "#e2463f", angle: -126 },
  { key: "inklusivitas", name: "Inklusivitas", color: "#f08a24", angle: 162 },
  { key: "pendidikan", name: "Pendidikan", color: "#2f7fe0", angle: 90 },
  { key: "lingkungan", name: "Lingkungan", color: "#25a862", angle: 18 },
  { key: "ekonomi", name: "Ekonomi", color: "#8a4fd0", angle: -54 },
];
export const AREA_COUNT = AREAS.length;

export const RING_LEN = 16;
export const GATE_LEN = 5;
export const PENT_LEN = 20;
/** Ring index of the tile where the private Gerbang lane starts. */
export const JUNCTION_R = 8;

export const RING_BASE = 0;
export const GATE_BASE = AREA_COUNT * RING_LEN; // 80
export const PENT_BASE = GATE_BASE + AREA_COUNT * GATE_LEN; // 105
export const BOARD_SIZE = PENT_BASE + PENT_LEN; // 125

export const ringId = (area: number, r: number) =>
  RING_BASE + area * RING_LEN + (((r % RING_LEN) + RING_LEN) % RING_LEN);
export const gateId = (area: number, g: number) => GATE_BASE + area * GATE_LEN + g;
export const pentId = (p: number) => PENT_BASE + (((p % PENT_LEN) + PENT_LEN) % PENT_LEN);
export const homeId = (area: number) => pentId(area * 4);
export const startId = (area: number) => ringId(area, 0);

export type Segment =
  | { seg: "ring"; area: number; r: number }
  | { seg: "gate"; area: number; g: number }
  | { seg: "pent"; p: number };

export function segmentOf(id: number): Segment {
  if (id < GATE_BASE) return { seg: "ring", area: Math.floor(id / RING_LEN), r: id % RING_LEN };
  if (id < PENT_BASE)
    return {
      seg: "gate",
      area: Math.floor((id - GATE_BASE) / GATE_LEN),
      g: (id - GATE_BASE) % GATE_LEN,
    };
  return { seg: "pent", p: id - PENT_BASE };
}

// --- Rule constants (from the rulebook) ---
export const TOTAL_VOTES = 100;
/** Each area's supply of vote tokens. */
export const AREA_STOCK = 20;
/** Votes in hand needed to enter the Gerbang Demokrasi. */
export const GATE_REQUIREMENT = 15;
/** Votes pledged to claim one Pentagon plot. */
export const PLEDGE = 5;
export const MAX_PLOTS = 3;
/** Challenger loses a plot duel: votes handed to the owner. */
export const DUEL_PENALTY = 2;
/** Pentagon laps every player must complete. */
export const PENT_LAPS = 2;
/** Standard play has no mandatory round limit. */
export const MAX_ROUNDS = Infinity;

/**
 * Jalur Luar layout for ring indices 0..15 (0 = START), copied from the printed board.
 * "warga" squares are empty pawn path: landing on them triggers nothing.
 * Their sub picks the printed look: "Terang" = glowing pale cell, "Polos" = plain cell.
 */
const RING_PATTERN: Array<[TileKind, string, string]> = [
  ["start", "START", ""],
  ["warga", "Jalan", "Terang"],
  ["demokrasi", "Demokrasi", "Cek Fakta"],
  ["aspirasi", "Aspirasi", "Sedang"],
  ["warga", "Jalan", "Polos"],
  ["kejutan", "Kejutan", "Kesempatan"],
  ["aspirasi", "Aspirasi", "Sulit"],
  ["warga", "Jalan", "Terang"],
  ["demokrasi", "Demokrasi", "Dilema"],
  ["aspirasi", "Aspirasi", "Mudah"],
  ["warga", "Jalan", "Polos"],
  ["kejutan", "Kejutan", "Peristiwa"],
  ["aspirasi", "Aspirasi", "Sedang"],
  ["warga", "Jalan", "Terang"],
  ["demokrasi", "Demokrasi", "Forum"],
  ["aspirasi", "Aspirasi", "Mudah"],
];

function buildTiles(): Tile[] {
  const out: Tile[] = [];
  for (let a = 0; a < AREA_COUNT; a++)
    for (let r = 0; r < RING_LEN; r++) {
      const [kind, name, sub] = RING_PATTERN[r]!;
      out.push({ id: ringId(a, r), kind, name, sub, area: a });
    }
  for (let a = 0; a < AREA_COUNT; a++)
    for (let g = 0; g < GATE_LEN; g++)
      out.push({ id: gateId(a, g), kind: "gate", name: "Putusan", sub: "Rakyat", area: a });
  for (let p = 0; p < PENT_LEN; p++) {
    const area = Math.floor(p / 4);
    out.push(
      p % 4 === 0
        ? { id: pentId(p), kind: "home", name: "Gerbang Aman", sub: AREAS[area]!.name, area }
        : { id: pentId(p), kind: "plot", name: "Wilayah", sub: `${PLEDGE} suara`, area },
    );
  }
  return out;
}

export const TILES: Tile[] = buildTiles();

/** Colour per area (kept for older imports). */
export const GROUP_COLORS = AREAS.map((a) => a.color);
