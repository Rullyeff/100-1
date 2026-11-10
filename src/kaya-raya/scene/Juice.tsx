import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { create } from "zustand";
import * as THREE from "three";
import { useGame } from "../store";
import { fmt } from "../sim/format";
import { TILE_H, pawnSpot } from "./layout";
import { cityColor } from "./cityPalette";
import { sfx } from "../audio";

/** Purely cosmetic: watches cash changes and shows floating numbers + flying coins. */
const POP_SECONDS = 1.6;
const COIN_COUNT = 24;
const COIN_SECONDS = 0.9;

interface Pop { id: number; x: number; z: number; amount: number }
interface Coin { from: THREE.Vector3; to: THREE.Vector3; t: number; delay: number; arc: number; live: boolean }

let popId = 0;
const usePops = create<{ pops: Pop[] }>(() => ({ pops: [] }));
const setPops = (f: (p: Pop[]) => Pop[]) => usePops.setState((s) => ({ pops: f(s.pops) }));
const popAge = new Map<number, number>();

export function CashFx() {
  const coins = useMemo<Coin[]>(
    () => Array.from({ length: COIN_COUNT }, () => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, delay: 0, arc: 1, live: false })),
    [],
  );
  const mesh = useRef<THREE.InstancedMesh>(null);
  const gold = useMemo(() => cityColor("gold"), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const proj = useMemo(() => new THREE.Vector3(), []);
  const { camera, size } = useThree();

  useEffect(() => {
    let prev = useGame.getState().game.players.map((p) => p.cash);
    return useGame.subscribe((s) => {
      const ps = s.game.players;
      const now = ps.map((p) => p.cash);
      if (now.length !== prev.length) { prev = now; return; }
      const diffs = now.map((c, i) => c - prev[i]!);
      prev = now;
      if (diffs.every((d) => d === 0)) return;
      const spot = (i: number) => { const [x, z] = pawnSpot(ps[i]!.pos, i); return new THREE.Vector3(x, TILE_H + 0.9, z); };
      const next: Pop[] = [];
      diffs.forEach((d, i) => { if (d !== 0 && !ps[i]!.bankrupt) { const p = spot(i); next.push({ id: ++popId, x: p.x, z: p.z, amount: d }); } });
      setPops((old) => [...old.slice(-6), ...next]);
      // Coins fly from payer to receiver; otherwise burst out of / rain onto the pawn.
      const payer = diffs.findIndex((d) => d < 0);
      const payee = diffs.findIndex((d) => d > 0);
      sfx.coins(payer >= 0 && payee >= 0 ? 8 : 4);
      const n = 10;
      let k = 0;
      for (const c of coins) {
        if (c.live || k >= n) continue;
        const jitter = () => (Math.random() - 0.5) * 0.4;
        if (payer >= 0 && payee >= 0) { c.from.copy(spot(payer)); c.to.copy(spot(payee)); c.arc = 2.2; }
        else if (payee >= 0) { c.to.copy(spot(payee)); c.from.copy(c.to).add(new THREE.Vector3(jitter() * 4, 2.5, jitter() * 4)); c.arc = 0.3; }
        else if (payer >= 0) { c.from.copy(spot(payer)); c.to.copy(c.from).add(new THREE.Vector3(jitter() * 5, 2, jitter() * 5)); c.arc = 1.2; }
        else continue;
        c.to.x += jitter(); c.to.z += jitter();
        c.t = 0; c.delay = k * 0.05; c.live = true; k++;
      }
    });
  }, [coins]);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    coins.forEach((c, i) => {
      if (c.live) {
        if (c.delay > 0) c.delay -= dt;
        else c.t += dt / COIN_SECONDS;
        if (c.t >= 1) c.live = false;
      }
      if (!c.live || c.delay > 0) { dummy.scale.setScalar(0); }
      else {
        dummy.position.lerpVectors(c.from, c.to, c.t);
        dummy.position.y += Math.sin(Math.PI * c.t) * c.arc;
        dummy.rotation.set(Math.PI / 2, c.t * 14, 0);
        dummy.scale.setScalar(1);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    for (const p of usePops.getState().pops) {
      const age = (popAge.get(p.id) ?? 0) + dt;
      popAge.set(p.id, age);
      if (age >= POP_SECONDS) { popAge.delete(p.id); setPops((o) => o.filter((x) => x.id !== p.id)); continue; }
      const node = document.querySelector<HTMLElement>(`[data-pop="${p.id}"]`);
      if (!node) continue;
      proj.set(p.x, TILE_H + 1.4 + age * 0.9, p.z).project(camera);
      const k = age / POP_SECONDS;
      const scale = k < 0.1 ? 0.3 + k * 9.5 : k < 0.2 ? 1.25 - (k - 0.1) * 2.5 : 1;
      node.style.opacity = String(k < 0.7 ? 1 : (1 - k) / 0.3);
      node.style.transform = `translate(${(proj.x + 1) / 2 * size.width}px, ${(1 - proj.y) / 2 * size.height}px) translate(-50%, -50%) scale(${scale})`;
    }
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, COIN_COUNT]} frustumCulled={false}>
        <cylinderGeometry args={[0.13, 0.13, 0.035, 14]} />
        <meshStandardMaterial color={gold} metalness={0.85} roughness={0.25} emissive={gold} emissiveIntensity={0.25} />
      </instancedMesh>
    </>
  );
}

/** DOM overlay (outside the Canvas); CashFx positions each pop per frame. */
export function CashPops() {
  const pops = usePops((s) => s.pops);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pops.map((p) => (
        <div key={p.id} data-pop={p.id} className="absolute left-0 top-0" style={{ transform: "translate(-999px,-999px)" }}>
          <div className={`cash-pop ${p.amount > 0 ? "cash-pop-good" : "cash-pop-bad"}`}>
            {p.amount > 0 ? "+" : "-"}{fmt(Math.abs(p.amount))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Gold confetti burst used by landmark completion. */
export function Confetti({ count = 40 }: { count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const parts = useMemo(
    () => Array.from({ length: count }, () => ({
      v: new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3),
      p: new THREE.Vector3(),
      r: Math.random() * 6,
    })),
    [count],
  );
  const colors = useMemo(() => [cityColor("gold"), cityColor("light"), cityColor("player-1"), cityColor("player-2"), cityColor("player-3")], []);
  useEffect(() => {
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) mesh.current?.setColorAt(i, c.set(colors[i % colors.length]!));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [colors, count]);
  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    parts.forEach((q, i) => {
      q.v.y -= 6 * dt;
      q.v.multiplyScalar(Math.exp(-1.2 * dt));
      q.p.addScaledVector(q.v, dt);
      q.r += dt * 8;
      dummy.position.copy(q.p);
      dummy.rotation.set(q.r, q.r * 0.7, 0);
      dummy.scale.setScalar(q.p.y < -0.5 ? 0 : 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[0.09, 0.05]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}
