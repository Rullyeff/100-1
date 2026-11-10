import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { create } from "zustand";
import * as THREE from "three";
import { useGame } from "../store";
import { fx, kick } from "../fx";
import { eventTollMultiplier } from "../sim/events";
import { TILE_H, pawnSpot, tileXform, PLAYER_HEX } from "./layout";
import { cityColor } from "./cityPalette";

/** Purely cosmetic effects derived from store changes; never writes game state. */

type Flash = { id: number; kind: "double" | "critical" | "bankrupt"; label: string };
let flashId = 0;
const useFlash = create<{ flash: Flash | null }>(() => ({ flash: null }));
function showFlash(kind: Flash["kind"], label: string, ms: number) {
  const id = ++flashId;
  useFlash.setState({ flash: { id, kind, label } });
  setTimeout(() => { if (useFlash.getState().flash?.id === id) useFlash.setState({ flash: null }); }, ms);
}

/** DOM overlay rendered outside the Canvas. */
export function SpectacleOverlay() {
  const flash = useFlash((s) => s.flash);
  if (!flash) return null;
  return (
    <div key={flash.id} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
      <div className={`fx-screen fx-screen-${flash.kind}`} />
      {flash.kind === "critical" && <div className="fx-action-lines" />}
      <div className={`fx-title fx-title-${flash.kind}`}>{flash.label}</div>
    </div>
  );
}

/** Watches dice, cash, positions and bankruptcies to trigger flashy moments. */
function useTriggers(onStep: (x: number, z: number, player: number) => void, onBankrupt: (x: number, z: number, player: number) => void) {
  useEffect(() => {
    let prev = useGame.getState();
    return useGame.subscribe((s) => {
      const p = prev;
      prev = s;
      // DOUBLE!
      if (p.rolling && !s.rolling && s.dice[0] === s.dice[1]) {
        kick(0.5);
        showFlash("double", "DOUBLE!", 1100);
      }
      const a = p.game.players, b = s.game.players;
      if (a.length !== b.length) return;
      b.forEach((pl, i) => {
        const old = a[i]!;
        if (pl.pos !== old.pos) { const [x, z] = pawnSpot(old.pos, i); onStep(x, z, i); }
        if (pl.bankrupt && !old.bankrupt) {
          const [x, z] = pawnSpot(pl.pos, i);
          onBankrupt(x, z, i);
          kick(0.8);
          showFlash("bankrupt", "BANGKRUT!", 1500);
        }
      });
      // Critical rent: paying into an opponent's landmark.
      const payer = b.findIndex((pl, i) => pl.cash < a[i]!.cash);
      const payee = b.findIndex((pl, i) => pl.cash > a[i]!.cash);
      if (payer >= 0 && payee >= 0) {
        const tile = b[payer]!.pos;
        if (s.game.owners[tile] === payee && s.game.levels[tile] === 4) {
          const t = tileXform(tile);
          fx.punch = 1; fx.punchX = t.x; fx.punchZ = t.z;
          kick(0.6);
          showFlash("critical", "CRITICAL!", 1000);
        }
      }
    });
  }, [onStep, onBankrupt]);
}

const STARS = 48;
const SHARDS = 40;

export function Spectacle() {
  const stars = useMemo(() => Array.from({ length: STARS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), t: 1 })), []);
  const shards = useMemo(() => Array.from({ length: SHARDS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0, t: 1 })), []);
  const starMesh = useRef<THREE.InstancedMesh>(null);
  const shardMesh = useRef<THREE.InstancedMesh>(null);
  const bolt = useRef<THREE.Mesh>(null);
  const boltT = useRef(1);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cursor = useRef(0);
  const gold = useMemo(() => cityColor("gold"), []);
  const shardMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#888", roughness: 0.4, metalness: 0.3 }), []);

  const onStep = useMemo(() => (x: number, z: number) => {
    for (let k = 0; k < 4; k++) {
      const s = stars[cursor.current++ % STARS]!;
      s.p.set(x + (Math.random() - 0.5) * 0.4, TILE_H + 0.1, z + (Math.random() - 0.5) * 0.4);
      s.v.set((Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6);
      s.t = 0;
    }
  }, [stars]);
  const onBankrupt = useMemo(() => (x: number, z: number, player: number) => {
    boltT.current = 0;
    bolt.current?.position.set(x, 4, z);
    shardMat.color.set(PLAYER_HEX[player]!);
    for (const s of shards) {
      s.p.set(x, TILE_H + 0.4, z);
      s.v.set((Math.random() - 0.5) * 5, 2 + Math.random() * 4, (Math.random() - 0.5) * 5);
      s.r = Math.random() * 6; s.t = 0;
    }
  }, [shards, shardMat]);
  useTriggers(onStep, onBankrupt);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const sm = starMesh.current, hm = shardMesh.current;
    if (sm) {
      stars.forEach((s, i) => {
        if (s.t < 1) { s.t += dt / 0.8; s.p.addScaledVector(s.v, dt); s.v.multiplyScalar(Math.exp(-2 * dt)); }
        dummy.position.copy(s.p);
        dummy.rotation.set(0, s.t * 6, s.t * 4);
        dummy.scale.setScalar(s.t < 1 ? (1 - s.t) * 0.9 : 0);
        dummy.updateMatrix(); sm.setMatrixAt(i, dummy.matrix);
      });
      sm.instanceMatrix.needsUpdate = true;
    }
    if (hm) {
      shards.forEach((s, i) => {
        if (s.t < 1) { s.t += dt / 1.4; s.v.y -= 9 * dt; s.p.addScaledVector(s.v, dt); if (s.p.y < TILE_H) { s.p.y = TILE_H; s.v.multiplyScalar(0.4); } s.r += dt * 9; }
        dummy.position.copy(s.p);
        dummy.rotation.set(s.r, s.r * 0.6, s.r * 0.3);
        dummy.scale.setScalar(s.t < 1 ? 1 - s.t * s.t : 0);
        dummy.updateMatrix(); hm.setMatrixAt(i, dummy.matrix);
      });
      hm.instanceMatrix.needsUpdate = true;
    }
    if (bolt.current) {
      boltT.current = Math.min(1, boltT.current + dt / 0.5);
      bolt.current.visible = boltT.current < 1 && Math.random() > 0.25;
      bolt.current.scale.set(1 + Math.random() * 0.6, 1, 1);
    }
  });

  return (
    <>
      <instancedMesh ref={starMesh} args={[undefined, undefined, STARS]} frustumCulled={false}>
        <octahedronGeometry args={[0.09, 0]} />
        <meshBasicMaterial color={gold} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={shardMesh} args={[undefined, undefined, SHARDS]} material={shardMat} frustumCulled={false}>
        <tetrahedronGeometry args={[0.12, 0]} />
      </instancedMesh>
      <mesh ref={bolt} visible={false}>
        <cylinderGeometry args={[0.06, 0.18, 8, 5, 6]} />
        <meshBasicMaterial color="#cfe6ff" toneMapped={false} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </mesh>
      <Beacons />
      <DangerAuras />
    </>
  );
}

/** Vertical light pillars over every landmark. */
function Beacons() {
  const levels = useGame((s) => s.game.levels);
  const owners = useGame((s) => s.game.owners);
  const tiles = levels.map((l, i) => (l === 4 ? i : -1)).filter((i) => i >= 0);
  return <>{tiles.map((i) => <Beacon key={i} tile={i} color={PLAYER_HEX[owners[i]!] ?? "#fff"} />)}</>;
}

function Beacon({ tile, color }: { tile: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = tileXform(tile);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    (m.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(clock.elapsedTime * 2 + tile) * 0.08;
    m.rotation.y = clock.elapsedTime * 0.5;
  });
  return (
    <mesh ref={ref} position={[t.x, TILE_H + 6, t.z]} renderOrder={2}>
      <cylinderGeometry args={[0.35, 0.55, 12, 16, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

const badgeCache = new Map<string, THREE.CanvasTexture>();
function badgeTexture(label: string) {
  let tex = badgeCache.get(label);
  if (tex) return tex;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c81e1e"; g.beginPath(); g.roundRect(8, 8, 240, 112, 40); g.fill();
  g.lineWidth = 8; g.strokeStyle = "#ffd36b"; g.stroke();
  g.fillStyle = "#fff"; g.font = "bold 72px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(label, 128, 68);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  badgeCache.set(label, tex);
  return tex;
}

/** Fiery pulsing ring + spinning multiplier badge on owned cities with boosted rent. */
function DangerAuras() {
  const game = useGame((s) => s.game);
  const list: { tile: number; mult: number }[] = [];
  game.owners.forEach((o, i) => {
    if (o < 0) return;
    const mult = (game.festival === i ? 2 : 1) * eventTollMultiplier(game, i);
    if (mult > 1) list.push({ tile: i, mult });
  });
  return <>{list.map((d) => <Aura key={d.tile} tile={d.tile} label={`x${Math.round(d.mult * 10) / 10}`} />)}</>;
}

function Aura({ tile, label }: { tile: number; label: string }) {
  const ring = useRef<THREE.Mesh>(null);
  const badge = useRef<THREE.Sprite>(null);
  const t = tileXform(tile);
  const map = useMemo(() => badgeTexture(label), [label]);
  useFrame(({ clock }) => {
    const k = clock.elapsedTime;
    if (ring.current) {
      const s = 1 + ((k * 0.8) % 1) * 0.35;
      ring.current.scale.set(s, s, 1);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ((k * 0.8) % 1));
    }
    if (badge.current) badge.current.position.y = TILE_H + 3.2 + Math.sin(k * 3 + tile) * 0.15;
  });
  return (
    <>
      <mesh ref={ring} position={[t.x, TILE_H + 0.06, t.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.8, 1.05, 32]} />
        <meshBasicMaterial color="#ff5a1f" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <sprite ref={badge} position={[t.x, TILE_H + 3.2, t.z]} scale={[1.2, 0.6, 1]}>
        <spriteMaterial map={map} depthTest={false} toneMapped={false} />
      </sprite>
    </>
  );
}
