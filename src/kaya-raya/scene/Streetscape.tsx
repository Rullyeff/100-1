import { useEffect, useMemo, useRef } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CITY_MOTION } from "./cityMotion";
import { ambience } from "./timeOfDay";
import { useReducedMotion } from "./useReducedMotion";
import { cityColor } from "./cityPalette";

/** Inner verge just inside the ring road's curb. */
const VERGE = CITY_MOTION.roadHalf - 0.42;
const PER_SIDE = 7;
const HELI_RADIUS = 7.5;
const HELI_HEIGHT = 5.2;
const HELI_SPEED = 0.12;

type Spot = { x: number; z: number; tree: boolean; s: number };

function spots(): Spot[] {
  const out: Spot[] = [];
  for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2;
    for (let i = 0; i < PER_SIDE; i++) {
      const u = -VERGE + 0.7 + (i / (PER_SIDE - 1)) * (VERGE * 2 - 1.4);
      const x = u, z = VERGE;
      out.push({ x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a), tree: i % 2 === 0, s: 0.85 + ((i * 37 + side * 11) % 10) / 30 });
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
  const reduced = useReducedMotion();
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

  const heli = useRef<THREE.Group>(null);
  const rotor = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  const angle = useRef(0.6);
  const dim = useMemo(() => new THREE.Color("#6b5a40"), []);
  const lit = useMemo(() => new THREE.Color("#ffd98a"), []);
  useFrame(({ clock }, delta) => {
    const n = ambience.night;
    mats.bulb.color.lerpColors(dim, lit, n);
    mats.pool.opacity = n * 0.35;
    if (beacon.current) beacon.current.opacity = Math.sin(clock.elapsedTime * 6) > 0.6 ? 1 : 0.1;
    if (reduced || !heli.current) return;
    const dt = Math.min(delta, 0.05);
    angle.current += HELI_SPEED * dt;
    const a = angle.current;
    heli.current.position.set(Math.cos(a) * HELI_RADIUS, HELI_HEIGHT + Math.sin(a * 3) * 0.25, Math.sin(a) * HELI_RADIUS);
    heli.current.rotation.set(0, -a, 0.12);
    if (rotor.current) rotor.current.rotation.y += 40 * dt;
  });

  return (
    <group name="streetscape">
      <mesh geometry={geos.trunk} material={mats.trunk} castShadow />
      <mesh geometry={geos.leaf} material={mats.leaf} castShadow />
      <mesh geometry={geos.pole} material={mats.pole} />
      <mesh geometry={geos.bulb} material={mats.bulb} />
      <mesh geometry={geos.pool} material={mats.pool} />
      <group ref={heli} position={[HELI_RADIUS, HELI_HEIGHT, 0]}>
        <mesh scale={[0.22, 0.16, 0.14]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color="#c8382e" metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh position={[-0.32, 0.03, 0]} scale={[0.3, 0.035, 0.035]}>
          <boxGeometry />
          <meshStandardMaterial color="#c8382e" />
        </mesh>
        <mesh ref={rotor} position={[0, 0.18, 0]}>
          <boxGeometry args={[0.7, 0.01, 0.04]} />
          <meshStandardMaterial color="#1e1e22" />
        </mesh>
        <mesh position={[0, -0.17, 0]}>
          <sphereGeometry args={[0.025, 8, 6]} />
          <meshBasicMaterial ref={beacon} color="#ff3030" transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
