import { useEffect, useMemo, useRef } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOARD_LEN } from "./layout";
import { ambience } from "./timeOfDay";
import { useReducedMotion } from "./useReducedMotion";

/** Miniature boulevard on the table around the board frame: paving, trees, lamps, cafés and walking people. */
const FLOOR = -0.6;
const INNER = (BOARD_LEN + 0.9) / 2 + 0.15;
const WIDTH = 1.4;
const MID = INNER + WIDTH / 2;
const PEOPLE = 44;
const WALK = 0.32;
const SHIRTS = ["#d9483b", "#2f7fe0", "#f2b51d", "#25a862", "#e9e4da", "#7a4fb5", "#e07a2f", "#2b2f36"];

/** Point on the square loop of half-size h at distance s along the perimeter. */
function onLoop(h: number, s: number, out: THREE.Vector3) {
  const side = 2 * h;
  const p = ((s % (side * 4)) + side * 4) % (side * 4);
  const k = Math.floor(p / side);
  const u = p - k * side - h;
  if (k === 0) out.set(u, 0, h);
  else if (k === 1) out.set(h, 0, -u);
  else if (k === 2) out.set(-u, 0, -h);
  else out.set(-h, 0, u);
  return k;
}

const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function CityEdge() {
  const reduced = useReducedMotion();
  const mats = useMemo(() => ({
    pave: new THREE.MeshStandardMaterial({ color: "#8a8178", roughness: 0.9 }),
    curb: new THREE.MeshStandardMaterial({ color: "#b9b1a4", roughness: 0.8 }),
    trunk: new THREE.MeshStandardMaterial({ color: "#5b3d27", roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#3f8f5c", roughness: 0.8, flatShading: true }),
    pole: new THREE.MeshStandardMaterial({ color: "#2a2d30", metalness: 0.6, roughness: 0.4 }),
    bulb: new THREE.MeshBasicMaterial({ color: "#ffd98a", toneMapped: false }),
    pool: new THREE.MeshBasicMaterial({ color: "#ffc970", transparent: true, depthWrite: false, toneMapped: false }),
    shade: new THREE.MeshStandardMaterial({ color: "#c8382e", roughness: 0.7, side: THREE.DoubleSide }),
    table: new THREE.MeshStandardMaterial({ color: "#efe7d8", roughness: 0.6 }),
    body: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    head: new THREE.MeshStandardMaterial({ color: "#c99a72", roughness: 0.6 }),
  }), []);

  const geos = useMemo(() => {
    const at = (g: THREE.BufferGeometry, x: number, z: number, s = 1) => g.clone().applyMatrix4(new THREE.Matrix4().makeScale(s, s, s).setPosition(x, FLOOR, z));
    const pave: THREE.BufferGeometry[] = [];
    const curb: THREE.BufferGeometry[] = [];
    const L = (INNER + WIDTH) * 2;
    for (let k = 0; k < 4; k++) {
      const along = k % 2 === 0, sg = k < 2 ? 1 : -1;
      const strip = new THREE.BoxGeometry(along ? L : WIDTH, 0.03, along ? WIDTH : L - WIDTH * 2);
      pave.push(strip.translate(along ? 0 : sg * MID, FLOOR + 0.015, along ? sg * MID : 0));
      const edge = new THREE.BoxGeometry(along ? L : 0.06, 0.06, along ? 0.06 : L);
      curb.push(edge.translate(along ? 0 : sg * (INNER + WIDTH), FLOOR + 0.03, along ? sg * (INNER + WIDTH) : 0));
    }
    const trunk = new THREE.CylinderGeometry(0.03, 0.045, 0.25, 6).translate(0, 0.155, 0);
    const leaf = new THREE.IcosahedronGeometry(0.2, 1).translate(0, 0.42, 0);
    const pole = new THREE.CylinderGeometry(0.015, 0.02, 0.6, 6).translate(0, 0.33, 0);
    const bulb = new THREE.SphereGeometry(0.045, 10, 8).translate(0, 0.64, 0);
    const pool = new THREE.CircleGeometry(0.4, 20).rotateX(-Math.PI / 2).translate(0, 0.035, 0);
    const shade = new THREE.ConeGeometry(0.22, 0.1, 12, 1, true).translate(0, 0.36, 0);
    const stick = new THREE.CylinderGeometry(0.008, 0.008, 0.34, 4).translate(0, 0.2, 0);
    const top = new THREE.CylinderGeometry(0.1, 0.1, 0.015, 12).translate(0, 0.13, 0);
    const out = { trunk: [] as THREE.BufferGeometry[], leaf: [] as THREE.BufferGeometry[], pole: [] as THREE.BufferGeometry[], bulb: [] as THREE.BufferGeometry[], pool: [] as THREE.BufferGeometry[], shade: [] as THREE.BufferGeometry[], table: [] as THREE.BufferGeometry[] };
    const v = new THREE.Vector3();
    const outerH = INNER + WIDTH - 0.2;
    const per = outerH * 8;
    const n = 40;
    for (let i = 0; i < n; i++) {
      onLoop(outerH, (i / n) * per, v);
      if (Math.abs(Math.abs(v.x) - outerH) < 0.3 && Math.abs(Math.abs(v.z) - outerH) < 0.3) continue;
      const kind = i % 5;
      if (kind === 2) {
        out.pole.push(at(pole, v.x, v.z)); out.bulb.push(at(bulb, v.x, v.z)); out.pool.push(at(pool, v.x, v.z));
      } else if (kind === 4) {
        out.shade.push(at(shade, v.x, v.z)); out.table.push(at(stick, v.x, v.z), at(top, v.x, v.z));
      } else {
        const s = 0.8 + rnd(i) * 0.45;
        out.trunk.push(at(trunk, v.x, v.z, s)); out.leaf.push(at(leaf, v.x, v.z, s));
      }
    }
    const merge = (l: THREE.BufferGeometry[]) => mergeGeometries(l.map((g) => g.index ? g.toNonIndexed() : g));
    return {
      pave: merge(pave), curb: merge(curb),
      trunk: merge(out.trunk), leaf: merge(out.leaf), pole: merge(out.pole), bulb: merge(out.bulb), pool: merge(out.pool), shade: merge(out.shade), table: merge(out.table),
    };
  }, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const people = useMemo(() => Array.from({ length: PEOPLE }, (_, i) => ({
    s: rnd(i + 3) * 100,
    lane: INNER + 0.25 + rnd(i + 9) * 0.55,
    dir: rnd(i + 17) > 0.5 ? 1 : -1,
    speed: WALK * (0.7 + rnd(i + 21) * 0.6),
    phase: rnd(i + 29) * 6,
    pause: rnd(i + 33) * 20,
  })), []);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const bodyGeo = useMemo(() => new THREE.CapsuleGeometry(0.035, 0.09, 3, 8).translate(0, 0.08, 0), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.03, 8, 6).translate(0, 0.19, 0), []);
  useEffect(() => () => { bodyGeo.dispose(); headGeo.dispose(); }, [bodyGeo, headGeo]);
  useEffect(() => {
    const c = new THREE.Color();
    for (let i = 0; i < PEOPLE; i++) bodies.current?.setColorAt(i, c.set(SHIRTS[i % SHIRTS.length]!));
    if (bodies.current?.instanceColor) bodies.current.instanceColor.needsUpdate = true;
  }, []);

  const dim = useMemo(() => new THREE.Color("#6b5a40"), []);
  const lit = useMemo(() => new THREE.Color("#ffd98a"), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(({ clock }, delta) => {
    const n = ambience.night;
    mats.bulb.color.lerpColors(dim, lit, n);
    mats.pool.opacity = n * 0.4;
    const b = bodies.current, h = heads.current;
    if (!b || !h) return;
    const dt = reduced ? 0 : Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    for (let i = 0; i < PEOPLE; i++) {
      const p = people[i]!;
      // Every so often a walker stops briefly, like window-shopping.
      const stopped = ((t + p.pause) % 24) < 2.5;
      if (!stopped) p.s += p.dir * p.speed * dt;
      const k = onLoop(p.lane, p.s, pos);
      const heading = -k * Math.PI / 2 + (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const bob = stopped ? 0 : Math.abs(Math.sin(t * 9 + p.phase)) * 0.012;
      q.setFromAxisAngle(up, heading);
      pos.y = FLOOR + 0.03 + bob;
      m.compose(pos, q, one);
      b.setMatrixAt(i, m);
      h.setMatrixAt(i, m);
    }
    b.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
  });

  return (
    <group name="city-edge">
      <mesh geometry={geos.pave} material={mats.pave} receiveShadow />
      <mesh geometry={geos.curb} material={mats.curb} receiveShadow />
      <mesh geometry={geos.trunk} material={mats.trunk} castShadow />
      <mesh geometry={geos.leaf} material={mats.leaf} castShadow />
      <mesh geometry={geos.pole} material={mats.pole} />
      <mesh geometry={geos.bulb} material={mats.bulb} />
      <mesh geometry={geos.pool} material={mats.pool} />
      <mesh geometry={geos.shade} material={mats.shade} castShadow />
      <mesh geometry={geos.table} material={mats.table} />
      <instancedMesh ref={bodies} args={[bodyGeo, mats.body, PEOPLE]} frustumCulled={false} castShadow />
      <instancedMesh ref={heads} args={[headGeo, mats.head, PEOPLE]} frustumCulled={false} />
    </group>
  );
}
