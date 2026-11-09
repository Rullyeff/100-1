import * as THREE from "three";
import { AREAS } from "../sim/board";
import { COIN_COLORS, voteCoinTextures } from "./textures";

/** Cylinder material groups: side, top cap, bottom cap. */
export type CoinMaterials = { faceUp: THREE.Material[]; backUp: THREE.Material[] };

const cache = new Map<number, CoinMaterials>();
/** Shared, immutable materials for area k's vote coin (icon face and logo back). */
export function coinMaterials(area: number): CoinMaterials {
  const hit = cache.get(area);
  if (hit) return hit;
  const key = AREAS[area]?.key ?? "inklusivitas";
  const { face, back } = voteCoinTextures(key);
  const side = new THREE.MeshStandardMaterial({ color: COIN_COLORS[key] ?? "#d99a16", metalness: 0.75, roughness: 0.3 });
  const faceMat = new THREE.MeshStandardMaterial({ map: face, metalness: 0.45, roughness: 0.32 });
  const backMat = new THREE.MeshStandardMaterial({ map: back, metalness: 0.45, roughness: 0.32 });
  const out = { faceUp: [side, faceMat, backMat], backUp: [side, backMat, faceMat] };
  cache.set(area, out);
  return out;
}
