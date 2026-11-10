import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../store";
import { TILE_H, pawnSpot, tileXform } from "./layout";
import { cityColor } from "./cityPalette";

/** Cosmetic extras: dice shockwave & embers, pawn emotes, landmark fireworks,
 *  penthouse rain + distant lightning, festival searchlights + balloon. Never writes game state. */

const DICE_HOMES: [number, number][] = [[2.9, 1.5], [1.5, 2.9]];
const EMBERS = 40;

function DiceImpact() {
  const rings = useRef<Array<THREE.Mesh | null>>([]);
  const ringT = useRef([1, 1]);
  const big = useRef(false);
  const embers = useMemo(() => Array.from({ length: EMBERS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), t: 1 })), []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => useGame.subscribe((s, p) => {
    if (p.rolling && !s.rolling) {
      big.current = s.dice[0] === s.dice[1];
      ringT.current = [0, 0];
      embers.forEach((e, i) => {
        const [hx, hz] = DICE_HOMES[i % 2]!;
        e.p.set(hx, 0.4, hz);
        const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * (big.current ? 4 : 2.5);
        e.v.set(Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp);
        e.t = 0;
      });
    }
  }), [embers]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    rings.current.forEach((r, i) => {
      if (!r) return;
      const t = (ringT.current[i] = Math.min(1, ringT.current[i]! + dt / 0.6));
      r.visible = t < 1;
      const s = 0.4 + t * (big.current ? 4 : 2.4);
      r.scale.set(s, s, 1);
      (r.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
    });
    const m = mesh.current;
    if (!m) return;
    embers.forEach((e, i) => {
      if (e.t < 1) { e.t += dt / 0.9; e.v.y -= 7 * dt; e.p.addScaledVector(e.v, dt); }
      dummy.position.copy(e.p);
      dummy.scale.setScalar(e.t < 1 ? (1 - e.t) * 0.08 : 0);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      {DICE_HOMES.map(([x, z], i) => (
        <mesh key={i} ref={(n) => { rings.current[i] = n; }} position={[x, 0.06, z]} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.42, 0.55, 40]} />
          <meshBasicMaterial color="#ffc24a" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      <instancedMesh ref={mesh} args={[undefined, undefined, EMBERS]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#ff8a2a" toneMapped={false} />
      </instancedMesh>
    </>
  );
}

const emoteCache = new Map<string, THREE.CanvasTexture>();
function emoteTex(icon: string, bg: string) {
  const key = icon + bg;
  let t = emoteCache.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.beginPath(); g.arc(64, 58, 50, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(50, 100); g.lineTo(64, 124); g.lineTo(78, 100); g.fill();
  g.fillStyle = "#fff"; g.font = "bold 64px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(icon, 64, 60);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  emoteCache.set(key, t);
  return t;
}

/** Happy star balloon when a pawn earns money, panic "!" when it pays. */
function Emotes() {
  const sprites = useRef<Array<THREE.Sprite | null>>([]);
  const state = useRef(Array.from({ length: 4 }, () => ({ t: 1, x: 0, z: 0, happy: true })));
  const happy = useMemo(() => emoteTex("★", "#e8a317"), []);
  const sad = useMemo(() => emoteTex("!", "#d23030"), []);
  useEffect(() => useGame.subscribe((s, p) => {
    const a = p.game.players, b = s.game.players;
    if (a.length !== b.length) return;
    b.forEach((pl, i) => {
      const d = pl.cash - a[i]!.cash;
      if (d === 0 || pl.bankrupt || i >= 4) return;
      const [x, z] = pawnSpot(pl.pos, i);
      Object.assign(state.current[i]!, { t: 0, x, z, happy: d > 0 });
    });
  }), []);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    state.current.forEach((st, i) => {
      const sp = sprites.current[i];
      if (!sp) return;
      st.t = Math.min(1, st.t + dt / 1.4);
      sp.visible = st.t < 1;
      if (!sp.visible) return;
      const mat = sp.material as THREE.SpriteMaterial;
      if (mat.map !== (st.happy ? happy : sad)) { mat.map = st.happy ? happy : sad; mat.needsUpdate = true; }
      const pop = Math.min(1, st.t * 6);
      const wobble = st.happy ? Math.abs(Math.sin(st.t * 18)) * 0.15 : Math.sin(st.t * 60) * 0.05;
      sp.position.set(st.x + (st.happy ? 0 : wobble), TILE_H + 1.5 + st.t * 0.5 + (st.happy ? wobble : 0), st.z);
      sp.scale.setScalar(0.55 * pop);
      mat.opacity = st.t > 0.75 ? (1 - st.t) * 4 : 1;
    });
  });
  return <>{[0, 1, 2, 3].map((i) => (
    <sprite key={i} ref={(n) => { sprites.current[i] = n; }} visible={false}>
      <spriteMaterial map={happy} transparent depthTest={false} toneMapped={false} />
    </sprite>
  ))}</>;
}

const SPARKS = 30;
/** Periodic mini fireworks above every landmark. */
function Fireworks() {
  const levels = useGame((s) => s.game.levels);
  const tiles = levels.map((l, i) => (l === 4 ? i : -1)).filter((i) => i >= 0);
  return <>{tiles.map((t) => <Firework key={t} tile={t} />)}</>;
}
function Firework({ tile }: { tile: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const sparks = useMemo(() => Array.from({ length: SPARKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3() })), []);
  const age = useRef(Math.random() * 3);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color().setHSL(Math.random(), 0.9, 0.6), []);
  const pos = tileXform(tile);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    age.current += dt;
    if (age.current > 3.2) {
      age.current = 0;
      color.setHSL(Math.random(), 0.9, 0.6);
      (mesh.current?.material as THREE.MeshBasicMaterial | undefined)?.color.copy(color);
      for (const s of sparks) {
        s.p.set(pos.x, TILE_H + 4.5, pos.z);
        s.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(1.6 + Math.random() * 0.6);
      }
    }
    const m = mesh.current;
    if (!m) return;
    const live = age.current < 1.4;
    sparks.forEach((s, i) => {
      if (live) { s.v.y -= 1.5 * dt; s.v.multiplyScalar(Math.exp(-1.2 * dt)); s.p.addScaledVector(s.v, dt); }
      dummy.position.copy(s.p);
      dummy.scale.setScalar(live ? 0.06 * (1 - age.current / 1.4) : 0);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
      <sphereGeometry args={[1, 5, 3]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
}

const DROPS = 260;
/** Rain streaks beyond the windows plus occasional distant lightning glow. */
function Weather() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const drops = useMemo(() => Array.from({ length: DROPS }, () => {
    const a = Math.random() * Math.PI * 2, r = 48 + Math.random() * 18;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: Math.random() * 40 - 8, s: 18 + Math.random() * 10 };
  }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flash = useRef({ next: 6, t: 1 });
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const m = mesh.current;
    if (m) {
      drops.forEach((d, i) => {
        d.y -= d.s * dt;
        if (d.y < -10) d.y = 32;
        dummy.position.set(d.x, d.y, d.z);
        dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
    const f = flash.current;
    f.next -= dt;
    if (f.next <= 0) { f.t = 0; f.next = 7 + Math.random() * 10; }
    f.t = Math.min(1, f.t + dt / 0.7);
    if (glow.current) {
      const flicker = f.t < 1 ? (1 - f.t) * (f.t < 0.15 || (f.t > 0.3 && f.t < 0.4) ? 1 : 0.3) : 0;
      glow.current.visible = flicker > 0;
      (glow.current.material as THREE.MeshBasicMaterial).opacity = flicker * 0.35;
    }
  });
  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, DROPS]} frustumCulled={false}>
        <boxGeometry args={[0.04, 1.6, 0.04]} />
        <meshBasicMaterial color="#9fb8d8" transparent opacity={0.35} depthWrite={false} toneMapped={false} fog={false} />
      </instancedMesh>
      <mesh ref={glow} position={[0, 14, 0]} visible={false}>
        <cylinderGeometry args={[69, 69, 50, 32, 1, true]} />
        <meshBasicMaterial color="#cfe0ff" transparent opacity={0} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </mesh>
    </>
  );
}

/** Crossing searchlights and a bobbing balloon over the World Cup host tile. */
function Festival() {
  const tile = useGame((s) => s.game.festival);
  const beams = useRef<Array<THREE.Mesh | null>>([]);
  const balloon = useRef<THREE.Group>(null);
  const gold = useMemo(() => cityColor("gold"), []);
  useFrame(({ clock }) => {
    const k = clock.elapsedTime;
    beams.current.forEach((b, i) => {
      if (!b) return;
      b.rotation.z = Math.sin(k * 0.9 + i * Math.PI) * 0.45;
      b.rotation.x = Math.cos(k * 0.7 + i) * 0.25;
    });
    if (balloon.current) { balloon.current.position.y = TILE_H + 3.6 + Math.sin(k * 1.4) * 0.25; balloon.current.rotation.y = k * 0.4; }
  });
  if (tile < 0) return null;
  const t = tileXform(tile);
  return (
    <group position={[t.x, 0, t.z]}>
      {[-1, 1].map((s, i) => (
        <group key={s} position={[s * 0.5, TILE_H, 0]}>
          <mesh ref={(n) => { beams.current[i] = n; }}>
            <group position={[0, 5, 0]}>
              <mesh>
                <coneGeometry args={[1.1, 10, 20, 1, true]} />
                <meshBasicMaterial color="#fff2c4" transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
              </mesh>
            </group>
          </mesh>
        </group>
      ))}
      <group ref={balloon}>
        <mesh>
          <sphereGeometry args={[0.45, 20, 16]} />
          <meshPhysicalMaterial color="#e23b3b" roughness={0.3} clearcoat={1} />
        </mesh>
        <mesh position={[0, -0.62, 0]}>
          <boxGeometry args={[0.2, 0.16, 0.2]} />
          <meshStandardMaterial color={gold} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

export function Extras({ lite }: { lite: boolean }) {
  return (
    <>
      <DiceImpact />
      <Emotes />
      <Fireworks />
      <Festival />
      {!lite && <Weather />}
    </>
  );
}
