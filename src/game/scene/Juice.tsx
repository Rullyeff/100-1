import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { create } from "zustand";
import * as THREE from "three";
import { useGame } from "../store";
import { fmt } from "../sim/format";
import { TILE_H, pawnSpot } from "./layout";
import { sfx } from "../audio";

/** Purely cosmetic: watches cash changes and shows floating +/− numbers (no flying coins). */
const POP_SECONDS = 1.6;

interface Pop { id: number; x: number; z: number; amount: number }

let popId = 0;
const usePops = create<{ pops: Pop[] }>(() => ({ pops: [] }));
const setPops = (f: (p: Pop[]) => Pop[]) => usePops.setState((s) => ({ pops: f(s.pops) }));
const popAge = new Map<number, number>();

export function CashFx() {
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
      const next: Pop[] = [];
      diffs.forEach((d, i) => {
        if (d !== 0 && !ps[i]!.bankrupt) {
          const [x, z] = pawnSpot(ps[i]!.pos, i);
          next.push({ id: ++popId, x, z, amount: d });
        }
      });
      setPops((old) => [...old.slice(-6), ...next]);
      const payer = diffs.findIndex((d) => d < 0);
      const payee = diffs.findIndex((d) => d > 0);
      sfx.coins(payer >= 0 && payee >= 0 ? 8 : 4);
    });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
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

  return null;
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
