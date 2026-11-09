import * as THREE from "three";
import { pentPoints } from "./layout";

function shapeOf(inr: number, hole?: number): THREE.Shape {
  const pts = pentPoints(inr).map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape(pts);
  if (hole !== undefined) shape.holes.push(new THREE.Path(pentPoints(hole).map(([x, y]) => new THREE.Vector2(x, y)).reverse()));
  return shape;
}

/**
 * Flat pentagon slab (or ring when `hole` is set) lying on the table, spanning world y from `bottom` to `bottom + height`.
 * Corners follow the arms, matching `pentCorner`.
 */
export function pentSlab(inr: number, height: number, bottom: number, hole?: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shapeOf(inr, hole), { depth: height, bevelEnabled: false, curveSegments: 1 });
  // Shape (x, y, depth) -> world (x, depth, -y).
  g.rotateX(-Math.PI / 2);
  g.translate(0, bottom, 0);
  return g;
}

/** Flat pentagon sheet facing up, with UVs that map world XZ onto a square texture of half-size `artHalf`. */
export function pentSheet(inr: number, artHalf: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shapeOf(inr), 1);
  const pos = g.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + artHalf) / (2 * artHalf);
    uv[i * 2 + 1] = (pos.getY(i) + artHalf) / (2 * artHalf);
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.rotateX(-Math.PI / 2);
  return g;
}
