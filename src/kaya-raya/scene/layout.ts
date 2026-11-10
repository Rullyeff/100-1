// Board geometry: where each tile sits in world space. Start is the corner nearest the camera.
export const CORNER = 2.4;
export const TILE_W = 1.5;
export const TILE_D = 2.4;
export const TILE_H = 0.22;
export const BOARD_LEN = CORNER * 2 + TILE_W * 7;
export const HALF = BOARD_LEN / 2;

export const PLAYER_HEX = ["#e2463f", "#2f7fe0", "#25a862", "#f2b51d"];

export interface TileXform {
  x: number;
  z: number;
  rotY: number;
  corner: boolean;
  /** Text must be rotated 180° to read from the camera. */
  flip: boolean;
}

const ROT = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

export function tileXform(i: number): TileXform {
  const side = Math.floor(i / 8);
  const k = i % 8;
  const cc = HALF - CORNER / 2;
  if (k === 0) {
    const pos = [
      [cc, cc],
      [-cc, cc],
      [-cc, -cc],
      [cc, -cc],
    ][side]!;
    return { x: pos[0]!, z: pos[1]!, rotY: 0, corner: true, flip: false };
  }
  const along = HALF - CORNER - TILE_W * (k - 0.5);
  const edge = HALF - TILE_D / 2;
  const pos = [
    [along, edge],
    [-edge, along],
    [-along, -edge],
    [edge, -along],
  ][side]!;
  return { x: pos[0]!, z: pos[1]!, rotY: ROT[side]!, corner: false, flip: side === 1 || side === 2 };
}

/** Local (tile-space) offsets so four pawns can share a tile. */
const PAWN_OFFSETS: [number, number][] = [
  [-0.36, 0.05],
  [0.36, 0.05],
  [-0.36, 0.6],
  [0.36, 0.6],
];

export function pawnSpot(tile: number, player: number): [number, number] {
  const t = tileXform(tile);
  const [lx, lz] = PAWN_OFFSETS[player]!;
  const scale = t.corner ? 1.4 : 1;
  const ox = lx * scale;
  const oz = t.corner ? (lz - 0.3) * scale : lz;
  const c = Math.cos(t.rotY);
  const s = Math.sin(t.rotY);
  // Rotation about Y: local (x, z) -> world (x cos + z sin, -x sin + z cos)
  return [t.x + ox * c + oz * s, t.z - ox * s + oz * c];
}
