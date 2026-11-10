// UI store + async controller that drives the pure turn generator.
import { create } from "zustand";
import { botAnswer } from "./sim/bot";
import { playTurn, type Req, type Tone } from "./sim/engine";
import { createGame, rollDice, type GameState } from "./sim/state";
import { sfx } from "./audio";
import { fx, kick } from "./fx";

export type Awaiting =
  | null
  | { kind: "roll" }
  | Extract<Req, { kind: "buy" }>
  | Extract<Req, { kind: "pick" }>;

interface Notice {
  id: number;
  text: string;
  tone: Tone;
  player?: number | undefined;
}

interface Banner {
  id: number;
  title: string;
  text: string;
  tone: Tone;
  player?: number | undefined;
}

interface Store {
  game: GameState;
  dice: [number, number];
  rollId: number;
  rolling: boolean;
  notice: Notice | null;
  banner: Banner | null;
  awaiting: Awaiting;
  fast: boolean;
  muted: boolean;
  answer: (value: unknown) => void;
  /** Human throw: power 0..1 from the hold-to-charge gauge. */
  throwDice: (power: number) => void;
  newGame: () => void;
  toggleFast: () => void;
  toggleMute: () => void;
}

/** Animation pacing (ms). */
const PACE = {
  botThink: 650,
  diceSpin: 1000,
  step: 220,
  jump: 750,
  notice: 1100,
  betweenTurns: 250,
};

let generation = 0;
let resolver: ((v: unknown) => void) | null = null;
let noticeId = 0;

const snapshot = (s: GameState): GameState => structuredClone(s);

export const useGame = create<Store>((set, get) => ({
  game: createGame(1),
  dice: [3, 4],
  rollId: 0,
  rolling: false,
  notice: null,
  banner: null,
  awaiting: null,
  fast: false,
  muted: false,
  answer: (value) => {
    const r = resolver;
    resolver = null;
    set({ awaiting: null });
    r?.(value);
  },
  throwDice: (power) => {
    fx.power = Math.max(0.25, Math.min(1, power));
    get().answer(undefined);
  },
  newGame: () => {
    resolver = null;
    const g = createGame((Math.random() * 2 ** 31) >>> 0);
    set({ game: g, awaiting: null, notice: null, banner: null, rolling: false });
    void runGame();
  },
  toggleFast: () => set({ fast: !get().fast }),
  toggleMute: () => {
    const muted = !get().muted;
    sfx.setMuted(muted);
    set({ muted });
  },
}));

const sleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, useGame.getState().fast ? ms * 0.45 : ms));

function waitForHuman(awaiting: Awaiting): Promise<unknown> {
  return new Promise((resolve) => {
    resolver = resolve;
    useGame.setState({ awaiting });
  });
}

async function handle(s: GameState, req: Req): Promise<unknown> {
  const isBot = "player" in req && req.player !== undefined ? s.players[req.player]!.isBot : true;
  switch (req.kind) {
    case "roll": {
      if (isBot) {
        await sleep(PACE.botThink);
        fx.power = 0.5 + Math.random() * 0.5;
      } else await waitForHuman({ kind: "roll" });
      const dice = rollDice(s);
      useGame.setState((st) => ({ dice, rolling: true, rollId: st.rollId + 1 }));
      sfx.diceThrow();
      await sleep(PACE.diceSpin);
      useGame.setState({ rolling: false });
      kick(0.12 + fx.power * 0.18);
      if (dice[0] === dice[1]) sfx.double();
      await sleep(250);
      return dice;
    }
    case "step":
      sfx.hop();
      if (req.salary) sfx.coin();
      await sleep(PACE.step);
      return undefined;
    case "jump":
      sfx.whoosh();
      await sleep(PACE.jump);
      return undefined;
    case "notice": {
      if (req.banner) {
        useGame.setState({
          notice: null,
          banner: { id: ++noticeId, title: req.banner, text: req.text, tone: req.tone, player: req.player },
        });
        kick(req.tone === "bad" ? 0.45 : 0.3);
        if (req.tone === "good") sfx.fanfare();
        else sfx.bad();
        await sleep(req.ms ?? PACE.notice);
        useGame.setState({ banner: null });
        return undefined;
      }
      useGame.setState({ notice: { id: ++noticeId, text: req.text, tone: req.tone, player: req.player } });
      if (req.tone === "good") sfx.coin();
      else if (req.tone === "bad") sfx.bad(true);
      await sleep(req.ms ?? PACE.notice);
      return undefined;
    }
    case "buy":
    case "pick": {
      if (isBot) {
        await sleep(PACE.botThink);
        return botAnswer(s, req);
      }
      return waitForHuman(req);
    }
  }
}

export async function runGame() {
  const my = ++generation;
  const s = snapshot(useGame.getState().game);
  while (!s.over) {
    const turn = playTurn(s);
    let r = turn.next();
    while (!r.done) {
      useGame.setState({ game: snapshot(s) });
      const ans = await handle(s, r.value);
      if (my !== generation) return;
      r = turn.next(ans);
    }
    useGame.setState({ game: snapshot(s), notice: null, banner: null });
    await sleep(PACE.betweenTurns);
    if (my !== generation) return;
  }
  sfx.win();
}

/** Starts the first game once per page load. */
export function startIfIdle() {
  if (generation === 0) useGame.getState().newGame();
}

// Dev-only handle for scripted screenshot checks (e.g. forcing a banner).
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __kayaRaya: typeof useGame }).__kayaRaya = useGame;
}
