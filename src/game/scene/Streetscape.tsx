import { useEffect, useMemo } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CITY_MOTION } from "./cityMotion";
import { ambience } from "./timeOfDay";
import { cityColor } from "./cityPalette";
import { nearTrack, pentLoop } from "./layout";

/** Inner verge just inside the ring road's curb. */
const VERGE = CITY_MOTION.roadIn - 0.42;
const PER_SIDE = 14;

type Spot = { x: number; z: number; tree: boolean; s: number };

function spots(): Spot[] {
  const out: Spot[] = [];
  const side = pentLoop(VERGE, 0).sideLen;
  for (let k = 0; k < 5; k++) {
    for (let i = 0; i < PER_SIDE; i++) {
      // Keep clear of the sharp corners, where the verge narrows.
      const t = 0.12 + (i / (PER_SIDE - 1)) * 0.76;
      const { x: wx, z: wz } = pentLoop(VERGE, (k + t) * side);
      if (nearTrack(wx, wz, 0.95)) continue;
      out.push({ x: wx, z: wz, tree: i % 2 === 0, s: 0.85 + ((i * 37 + k * 11) % 10) / 30 });
    }
  }
  return out;
}

const trunkGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.18, 6).translate(0, 0.09, 0);
const leafGeo = new THREE.IcosahedronGeometry(0.15, 1).translate(0, 0.3, 0);
const poleGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.42, 6).translate(0, 0.21, 0);
const bulbGeo = new THREE.SphereGeometry(0.035, 10, 8).translate(0, 0.43, 0);
const poolGeo = new THREE.CircleGeometry(0.28, 20).rotateX(-Math.PI / 2).translate(0, 0.035, 0);

export function Streetscape() {
  const all = useMemo(spots, []);
  const trees = useMemo(() => all.filter((p) => p.tree), [all]);
  const lamps = useMemo(() => all.filter((p) => !p.tree), [all]);
  const mats = useMemo(() => ({
    trunk: new THREE.MeshStandardMaterial({ color: "#5b3d27", roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: cityColor("park") || "#3d9c71", roughness: 0.8, flatShading: true }),
    pole: new THREE.MeshStandardMaterial({ color: "#2a2d30", metalness: 0.6, roughness: 0.4 }),
    bulb: new THREE.MeshBasicMaterial({ color: "#ffd98a", toneMapped: false }),
    pool: new THREE.MeshBasicMaterial({ color: "#ffc970", transparent: true, depthWrite: false, toneMapped: false }),
  }), []);
  const geos = useMemo(() => {
    const build = (g: THREE.BufferGeometry, list: Spot[], scaled: boolean) => mergeGeometries(list.map((p) => {
      const s = scaled ? p.s : 1;
      return g.clone().applyMatrix4(new THREE.Matrix4().makeScale(s, s, s).setPosition(p.x, 0.04, p.z));
    }));
    return { trunk: build(trunkGeo, trees, true), leaf: build(leafGeo, trees, true), pole: build(poleGeo, lamps, false), bulb: build(bulbGeo, lamps, false), pool: build(poolGeo, lamps, false) };
  }, [trees, lamps]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const dim = useMemo(() => new THREE.Color("#6b5a40"), []);
  const lit = useMemo(() => new THREE.Color("#ffd98a"), []);
  useFrame(() => {
    const n = ambience.night;
    mats.bulb.color.lerpColors(dim, lit, n);
    mats.pool.opacity = n * 0.35;
  });

  return (
    <group name="streetscape">
      <mesh geometry={geos.trunk} material={mats.trunk} castShadow />
      <mesh geometry={geos.leaf} material={mats.leaf} castShadow />
      <mesh geometry={geos.pole} material={mats.pole} />
      <mesh geometry={geos.bulb} material={mats.bulb} />
      <mesh geometry={geos.pool} material={mats.pool} />
    </group>
  );
}
