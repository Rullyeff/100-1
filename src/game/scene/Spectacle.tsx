import { useEffect } from "react";
import { create } from "zustand";
import { useGame } from "../store";
import { fx, kick } from "../fx";
import { pawnSpot, tileXform } from "./layout";

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
      // A six on the single die earns the big flash.
      if (p.rolling && !s.rolling && s.dice === 6) {
        kick(0.5);
        showFlash("double", "ENAM!", 1100);
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
          showFlash("bankrupt", "GUGUR!", 1500);
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

const noop = () => {};

/** Keeps the big flash titles and camera kicks; sparkles, shards and light pillars were removed for a calmer board. */
export function Spectacle() {
  useTriggers(noop, noop);
  return null;
}
