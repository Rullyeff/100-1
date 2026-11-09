// Board geometry for the 100 SUARA pentagon board: where each tile sits in world space.
// Screen-up (away from the camera) is world -Z. Arms follow AREAS[k].angle.
import { AREAS, AREA_COUNT, BOARD_SIZE, GATE_LEN, JUNCTION_R, PENT_LEN, segmentOf } from "../sim/board";

/** Grid cell and rendered tile size. */
export const CELL = 1;
export const TILE = 0.92;
export const TILE_H = 0.22;
/** Radius of the round Gerbang Aman tiles at the pentagon corners. */
export const HOME_R = 0.66;

const DEG = Math.PI / 180;
/** Pentagon side (corner to corner) = 3 plots + a corner disc. */
const PENT_SIDE = 3 * CELL + 2 * 0.65;
export const PENT_R = PENT_SIDE / (2 * Math.sin(36 * DEG));
/** Distance from the centre to the loop's inner long side. */
export const RING_U = PENT_R + 0.65 + 0.5 + GATE_LEN * CELL;

export const PLAYER_HEX = AREAS.map((a) => a.color);

export interface TileXform {
  x: number;
  z: number;
  /** Rotation of the tile so its printed label reads from the camera. */
  rotY: number;
  /** Round corner disc (Gerbang Aman). */
  corner: boolean;
  /** Kept for older callers; labels are pre-rotated so this is always false. */
  flip: boolean;
}

/** Screen-space unit vectors (x right, y up) for an arm. */
export function armAxes(area: number) {
  const a = AREAS[area]!.angle * DEG;
  const out = { x: Math.cos(a), y: Math.sin(a) };
  const perp = { x: Math.sin(a), y: -Math.cos(a) };
  return { out, perp };
}

/** Rotation that makes a square tile's text upright-ish: pick the 90° turn closest to screen-up. */
function uprightRot(ax: { x: number; y: number }, bx: { x: number; y: number }) {
  const cands = [ax, bx, { x: -ax.x, y: -ax.y }, { x: -bx.x, y: -bx.y }];
  const up = cands.reduce((best, c) => (c.y > best.y ? c : best));
  return Math.atan2(-up.x, up.y);
}

/** Ring index -> (u along the arm, v across it) in cells. */
function ringLocal(r: number): [number, number] {
  const a = RING_U;
  if (r === 0) return [a + 2, 0];
  if (r <= 3) return [a + 2, r];
  if (r === 4) return [a + 1, 3];
  if (r <= 11) return [a, 3 - (r - 5)];
  if (r === 12) return [a + 1, -3];
  return [a + 2, r - 16];
}

function compute(i: number): TileXform {
  const seg = segmentOf(i);
  if (seg.seg === "pent") {
    const k = Math.floor(seg.p / 4);
    const j = seg.p % 4;
    const v0 = armAxes(k).out;
    if (j === 0) return { x: v0.x * PENT_R, z: -v0.y * PENT_R, rotY: 0, corner: true, flip: false };
    const v1 = armAxes((k + 1) % AREA_COUNT).out;
    const t = (0.65 + 0.5 + (j - 1) * CELL) / PENT_SIDE;
    const sx = (v0.x + (v1.x - v0.x) * t) * PENT_R;
    const sy = (v0.y + (v1.y - v0.y) * t) * PENT_R;
    const edge = { x: v1.x - v0.x, y: v1.y - v0.y };
    const len = Math.hypot(edge.x, edge.y);
    const e = { x: edge.x / len, y: edge.y / len };
    return { x: sx, z: -sy, rotY: uprightRot(e, { x: e.y, y: -e.x }), corner: false, flip: false };
  }
  const area = seg.area;
  const { out, perp } = armAxes(area);
  const [u, v] = seg.seg === "ring" ? ringLocal(seg.r) : [RING_U - 1 - seg.g, 0];
  const sx = out.x * u + perp.x * v;
  const sy = out.y * u + perp.y * v;
  return { x: sx, z: -sy, rotY: uprightRot(out, perp), corner: false, flip: false };
}

const XFORMS: TileXform[] = Array.from({ length: BOARD_SIZE }, (_, i) => compute(i));

export function tileXform(i: number): TileXform {
  return XFORMS[i] ?? XFORMS[0]!;
}

/** Half-size of the square table top that holds every tile with a margin. */
export const TABLE_HALF = Math.ceil(
  XFORMS.reduce((m, t) => Math.max(m, Math.abs(t.x) + 0.7, Math.abs(t.z) + 0.7), 0) + 1.3,
);
/** Pentagon table: corners point along the five arms, flat sides face the open wedges (front side faces the camera). */
export const TABLE_IN = Math.ceil(
  (XFORMS.reduce((m, t) => Math.max(m, ...[0, 1, 2, 3, 4].map((k) => {
    const w = (90 + 36 + 72 * k) * DEG;
    return t.x * Math.cos(w) - t.z * Math.sin(w);
  })), 0) + 1.75) * 10,
) / 10;
const TAN36 = Math.tan(36 * DEG);

/** World XZ of pentagon corner k (k=0 is the top arm) for a pentagon of inradius `inr`. */
export function pentCorner(inr: number, k: number): [number, number] {
  const r = inr / Math.cos(36 * DEG);
  const a = (90 + 72 * k) * DEG;
  return [Math.cos(a) * r, -Math.sin(a) * r];
}

/** Point on the pentagon of inradius `inr` at perimeter distance `s`; heading turns local +Z along the side. */
export function pentLoop(inr: number, s: number) {
  const side = 2 * inr * TAN36;
  const perimeter = side * 5;
  const d = ((s % perimeter) + perimeter) % perimeter;
  const k = Math.min(4, Math.floor(d / side));
  const t = (d - k * side) / side;
  const [ax, az] = pentCorner(inr, k);
  const [bx, bz] = pentCorner(inr, k + 1);
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, heading: Math.atan2(bx - ax, bz - az), side: k, t, perimeter, sideLen: side };
}

/** Rotation-y that turns local +Z toward the middle of pentagon side k (local X then runs along the side). */
export function pentSideRotation(k: number): number {
  const w = (90 + 36 + 72 * k) * DEG;
  return Math.atan2(Math.cos(w), -Math.sin(w));
}

/** Pentagon outline in shape space (shape y = world -Z), for extrusions rotated flat onto the table. */
export function pentPoints(inr: number): [number, number][] {
  return [0, 1, 2, 3, 4].map((k) => {
    const [x, z] = pentCorner(inr, k);
    return [x, -z];
  });
}

/** Kept for city-edge code: frame outer size minus its lip. */
export const BOARD_LEN = TABLE_HALF * 2 - 0.9;
export const HALF = TABLE_HALF;

/** True when (x, z) lies within `r` of any tile centre (used to keep decorations off the track). */
export function nearTrack(x: number, z: number, r: number): boolean {
  return XFORMS.some((t) => Math.hypot(t.x - x, t.z - z) < r);
}

/** World position in the open wedge between arm k and the next arm clockwise, at radius r. */
export function gapSpot(k: number, r: number): [number, number] {
  const a = (AREAS[k]!.angle - 36) * DEG;
  return [Math.cos(a) * r, -Math.sin(a) * r];
}

/** Resting spot of the die: the open wedge nearest the camera. */
// Beside the 100 SUARA logo in the front wedge, so the resting die never covers it.
export const DICE_HOME: [number, number] = (() => {
  const [x, z] = gapSpot(4, 7.6);
  return [x + 3.1, z];
})();

/** Where the junction tile (loop -> gate lane) of an area sits. */
export const junctionTile = (area: number) => area * 16 + JUNCTION_R;

/** World offsets so up to five pawns can share a tile. */
const PAWN_OFFSETS: [number, number][] = [
  [-0.2, 0.18],
  [0.2, 0.18],
  [-0.2, -0.18],
  [0.2, -0.18],
  [0, 0],
];

export function pawnSpot(tile: number, player: number): [number, number] {
  const t = tileXform(tile);
  const [ox, oz] = PAWN_OFFSETS[player % PAWN_OFFSETS.length]!;
  const k = t.corner ? 1.25 : 1;
  return [t.x + ox * k, t.z + oz * k];
}

export { PENT_LEN };
