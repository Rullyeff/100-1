import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useGame } from "../store";
import { fx } from "../fx";
import { PLAYER_HEX, TILE_H, pawnSpot } from "./layout";
import { brushedRoughness, shadowBlob } from "./textures";

const FLOOR = TILE_H + 0.02;
const HOP_TIME = 0.2;
const JUMP_TIME = 0.7;
const DUST_TIME = 0.45;

const pawnGeo = (() => {
  const pts = [
    [0, 0],
    [0.3, 0],
    [0.3, 0.07],
    [0.22, 0.12],
    [0.13, 0.3],
    [0.1, 0.55],
    [0.18, 0.62],
    [0.1, 0.68],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 48);
  g.computeVertexNormals();
  return g;
})();
const headGeo = new THREE.SphereGeometry(0.17, 32, 20);
const gemGeo = new THREE.OctahedronGeometry(0.065, 0).scale(1, 1.35, 1);
const baseBandGeo = new THREE.TorusGeometry(0.3, 0.032, 12, 48);
const collarGeo = new THREE.TorusGeometry(0.18, 0.026, 10, 40);

/** Collector-piece finishes per seat: polished gold (you), brushed chrome, brushed rose gold, glossy obsidian ceramic. */
const FINISHES: Array<() => THREE.MeshPhysicalMaterial> = [
  () => new THREE.MeshPhysicalMaterial({ color: "#ffc76a", metalness: 1, roughness: 0.16, envMapIntensity: 1.25 }),
  () =>
    new THREE.MeshPhysicalMaterial({
      color: "#dfe3e8",
      metalness: 1,
      roughness: 0.32,
      roughnessMap: brushedRoughness(),
      anisotropy: 0.7,
      envMapIntensity: 1.15,
    }),
  () =>
    new THREE.MeshPhysicalMaterial({
      color: "#eaa58c",
      metalness: 1,
      roughness: 0.26,
      roughnessMap: brushedRoughness(),
      anisotropy: 0.6,
      envMapIntensity: 1.15,
    }),
  () =>
    new THREE.MeshPhysicalMaterial({
      color: "#121014",
      metalness: 0,
      roughness: 0.12,
      specularIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1,
    }),
];
/**
 * Pieces reflect a dedicated studio-room probe: the table's sparse Lightformer
 * environment leaves mirror metal mostly black. Built once per renderer.
 */
let pieceEnv: THREE.Texture | null = null;
function ensurePieceEnv(gl: THREE.WebGLRenderer) {
  if (pieceEnv) return pieceEnv;
  const pm = new THREE.PMREMGenerator(gl);
  const room = new RoomEnvironment();
  pieceEnv = pm.fromScene(room, 0.04).texture;
  room.dispose();
  pm.dispose();
  return pieceEnv;
}
const withEnv = <T extends THREE.MeshPhysicalMaterial>(m: T) => {
  m.envMap = pieceEnv;
  return m;
};

const finishCache: THREE.MeshPhysicalMaterial[] = [];
const finishFor = (i: number) => (finishCache[i] ??= withEnv(FINISHES[i % FINISHES.length]!()));

/** Player-coloured enamel inlay so each finish still reads as its seat colour. */
const enamelCache: THREE.MeshPhysicalMaterial[] = [];
const enamelFor = (i: number) =>
  (enamelCache[i] ??= withEnv(new THREE.MeshPhysicalMaterial({
    color: PLAYER_HEX[i]!,
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.8,
  })));
const gemCache: THREE.MeshPhysicalMaterial[] = [];
const gemFor = (i: number) =>
  (gemCache[i] ??= withEnv(new THREE.MeshPhysicalMaterial({
    color: PLAYER_HEX[i]!,
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    specularIntensity: 1,
    emissive: PLAYER_HEX[i]!,
    emissiveIntensity: 0.25,
    flatShading: true,
    envMapIntensity: 1.2,
  })));
const shadowGeo = new THREE.PlaneGeometry(1.25, 1.25).translate(-0.1, 0.08, 0);
let shadowMat: THREE.MeshBasicMaterial | null = null;
const getShadowMat = () => (shadowMat ??= new THREE.MeshBasicMaterial({ map: shadowBlob(), transparent: true, depthWrite: false, toneMapped: false }));

export function Tokens() {
  ensurePieceEnv(useThree((s) => s.gl));
  const count = useGame((s) => s.game.players.length);
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Pawn key={i} index={i} />
      ))}
    </>
  );
}

/** Max tilt (radians) a pawn leans toward where it is hopping. */
const LEAN = 0.22;

function Pawn({ index }: { index: number }) {
  const tile = useGame((s) => s.game.players[index]!.pos);
  const bankrupt = useGame((s) => s.game.players[index]!.bankrupt);
  const isTurn = useGame((s) => s.game.turn === index && !s.game.over);
  const g = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Mesh>(null);
  const anim = useRef({ from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, dur: HOP_TIME, arc: 0.6, tile: -1 });
  const mat = finishFor(index);
  const enamel = enamelFor(index);
  const gem = gemFor(index);
  const body = useRef<THREE.Group>(null);
  const puff = useRef<THREE.Mesh>(null);
  const dust = useRef({ t: 1 });
  const shadow = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    const grp = g.current;
    if (!grp) return;
    const a = anim.current;
    const dt = Math.min(delta, 0.05);
    if (a.tile !== tile) {
      const [x, z] = pawnSpot(tile, index);
      a.to.set(x, FLOOR, z);
      if (a.tile === -1) {
        grp.position.copy(a.to);
        a.t = 1;
      } else {
        a.from.copy(grp.position);
        const far = a.from.distanceTo(a.to) > 2.6;
        a.dur = far ? JUMP_TIME : HOP_TIME;
        a.arc = far ? 3.5 : 0.6;
        a.t = 0;
      }
      a.tile = tile;
    }
    if (a.t < 1) {
      a.t = Math.min(1, a.t + dt / a.dur);
      if (a.t >= 1) dust.current.t = 0;
      grp.position.lerpVectors(a.from, a.to, a.t);
      grp.position.y = FLOOR + Math.sin(Math.PI * a.t) * a.arc;
      fx.track = 1;
      fx.trackX = grp.position.x;
      fx.trackZ = grp.position.z;
    }
    // Squash & stretch: stretch mid-air, squash on landing
    if (body.current) {
      const air = a.t < 1 ? Math.sin(Math.PI * a.t) : 0;
      const land = a.t < 1 && a.t > 0.85 ? (a.t - 0.85) / 0.15 : 0;
      const sy = 1 + air * 0.12 - Math.sin(Math.PI * land) * 0.2;
      body.current.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
      // Lean into the hop direction mid-air, settle upright on landing.
      const dx = a.to.x - a.from.x, dz = a.to.z - a.from.z;
      const lean = a.t < 1 ? Math.sin(Math.PI * a.t) * LEAN : 0;
      const l = Math.hypot(dx, dz) || 1;
      const k = 1 - Math.exp(-14 * dt);
      body.current.rotation.x += ((dz / l) * lean - body.current.rotation.x) * k;
      body.current.rotation.z += ((-dx / l) * lean - body.current.rotation.z) * k;
    }
    // Contact shadow stays on the board and softens as the pawn leaves it.
    if (shadow.current) {
      const lift = grp.position.y - FLOOR;
      shadow.current.position.y = 0.03 - lift;
      shadow.current.scale.setScalar(1 + lift * 0.35);
      shadow.current.visible = lift < 3;
    }
    const ds = dust.current;
    if (puff.current) {
      ds.t += dt / DUST_TIME;
      puff.current.visible = ds.t < 1;
      puff.current.scale.setScalar(0.4 + ds.t * 1.4);
      (puff.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - ds.t));
    }
    if (marker.current) {
      marker.current.visible = isTurn;
      marker.current.position.y = 1.35 + Math.sin(clock.elapsedTime * 4) * 0.12;
      marker.current.rotation.y = clock.elapsedTime * 2;
    }
  });

  if (bankrupt) return null;

  return (
    <group ref={g}>
      <mesh ref={shadow} geometry={shadowGeo} material={getShadowMat()} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} renderOrder={1} />
      <group ref={body}>
        <mesh geometry={pawnGeo} material={mat} castShadow />
        <mesh geometry={headGeo} material={mat} position={[0, 0.82, 0]} castShadow />
        <mesh geometry={baseBandGeo} material={enamel} position={[0, 0.04, 0]} rotation-x={Math.PI / 2} castShadow />
        <mesh geometry={collarGeo} material={enamel} position={[0, 0.62, 0]} rotation-x={Math.PI / 2} />
        <mesh geometry={gemGeo} material={gem} position={[0, 1.04, 0]} />
      </group>
      <mesh ref={puff} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.28, 0.42, 24]} />
        <meshBasicMaterial color={PLAYER_HEX[index]!} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={marker} position={[0, 1.35, 0]} rotation-x={Math.PI}>
        <coneGeometry args={[0.16, 0.3, 4]} />
        <meshStandardMaterial color="#ffd23f" emissive="#c98a00" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}
