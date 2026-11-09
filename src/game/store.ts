// UI store + async controller that drives the pure turn generator.
import { create } from "zustand";
import { botAnswer } from "./sim/bot";
import { playTurn, type Req, type Tone } from "./sim/engine";
import { createGame, rollDie, type BotSetup, type GameState } from "./sim/state";
import { sfx } from "./audio";
import { fx, kick } from "./fx";

export type Awaiting =
  | null
  | { kind: "roll" }
  | Extract<Req, { kind: "buy" }>
  | Extract<Req, { kind: "choose" }>
  | Extract<Req, { kind: "debate" }>
  | Extract<Req, { kind: "quiz" }>;

interface Notice {
  id: number;
  text: string;
  tone: Tone;
  player?: number | undefined;
  /** How long the notice stays up (already adjusted for fast mode), for the countdown bar. */
  ms: number;
}

interface Banner {
  id: number;
  title: string;
  text: string;
  tone: Tone;
  player?: number | undefined;
}

interface Store {
  online: boolean;
  mySeat: number;
  onlineActor: number | null;
  game: GameState;
  dice: number;
  rollId: number;
  rolling: boolean;
  notice: Notice | null;
  banner: Banner | null;
  awaiting: Awaiting;
  fast: boolean;
  muted: boolean;
  paused: boolean;
  answer: (value: unknown) => void;
  /** Human throw: power 0..1 from the hold-to-charge gauge. */
  throwDice: (power: number) => void;
  /** Offline bot setup used by new games; the setup screen shows until the first start. */
  botSetup: BotSetup;
  avatar: number;
  setAvatar: (i: number) => void;
  setupOpen: boolean;
  openSetup: () => void;
  newGame: (setup?: BotSetup) => void;
  toggleFast: () => void;
  toggleMute: () => void;
  togglePause: () => void;
}

/** Pause after the dice settle (ms): the camera spotlights the result before the piece moves. */
export const DICE_RESULT_HOLD_MS = 1300;

/** Animation pacing (ms). */
const PACE = {
  botThink: 1700,
  diceSpin: 1400,
  diceSettle: DICE_RESULT_HOLD_MS,
  step: 480,
  jump: 1400,
  notice: 2800,
  betweenTurns: 1300,
};

let generation = 0;
let resolver: ((v: unknown) => void) | null = null;
let noticeId = 0;

const snapshot = (s: GameState): GameState => structuredClone(s);

export const useGame = create<Store>((set, get) => ({
  online: false,
  mySeat: 0,
  onlineActor: null,
  game: createGame(1),
  dice: 5,
  rollId: 0,
  rolling: false,
  notice: null,
  banner: null,
  awaiting: null,
  fast: false,
  muted: false,
  paused: false,
  avatar: 0,
  setAvatar: (i) => { set({ avatar: i }); try { localStorage.setItem("my-avatar", String(i)); } catch { /* ignore */ } },
  botSetup: { opponents: 4, level: "sedang", styles: ["seimbang", "agresif", "hemat", "seimbang"] },
  setupOpen: false,
  openSetup: () => { if (!get().online) set({ setupOpen: true, paused: true }); },
  answer: (value) => {
    if (get().online) { onlineAnswer?.(value); return; }
    const r = resolver;
    resolver = null;
    set({ awaiting: null });
    r?.(value);
  },
  throwDice: (power) => {
    fx.power = Math.max(0.25, Math.min(1, power));
    get().answer(undefined);
  },
  newGame: (setup) => {
    if (get().online) return;
    resolver = null;
    const botSetup = setup ?? get().botSetup;
    const g = createGame((Math.random() * 2 ** 31) >>> 0, 1, botSetup);
    set({ game: g, botSetup, setupOpen: false, awaiting: null, notice: null, banner: null, rolling: false, paused: false });
    void runGame();
  },
  toggleFast: () => set({ fast: !get().fast }),
  togglePause: () => { if (!get().online) set({ paused: !get().paused }); },
  toggleMute: () => {
    const muted = !get().muted;
    sfx.setMuted(muted);
    set({ muted });
  },
}));

const sleep = (ms: number) =>
  new Promise<void>((r) => {
    setTimeout(
      () => {
        // While paused, poll until the player resumes before continuing the turn.
        const wait = () => (useGame.getState().paused ? setTimeout(wait, 120) : r());
        wait();
      },
      useGame.getState().fast ? ms * 0.45 : ms,
    );
  });

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
      const dice = rollDie(s);
      useGame.setState((st) => ({ dice, rolling: true, rollId: st.rollId + 1 }));
      sfx.diceThrow();
      await sleep(PACE.diceSpin);
      useGame.setState({ rolling: false });
      kick(0.12 + fx.power * 0.18);
      await sleep(PACE.diceSettle);
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
          banner: {
            id: ++noticeId,
            title: req.banner,
            text: req.text,
            tone: req.tone,
            player: req.player,
          },
        });
        kick(req.tone === "bad" ? 0.45 : 0.3);
        if (req.tone === "good") sfx.fanfare();
        else sfx.bad();
        await sleep(req.ms ?? PACE.notice);
        useGame.setState({ banner: null });
        return undefined;
      }
      useGame.setState({
        notice: {
          id: ++noticeId,
          text: req.text,
          tone: req.tone,
          player: req.player,
          ms: (req.ms ?? PACE.notice) * (useGame.getState().fast ? 0.45 : 1),
        },
      });
      if (req.tone === "good") sfx.coin();
      else if (req.tone === "bad") sfx.bad(true);
      await sleep(req.ms ?? PACE.notice);
      return undefined;
    }
    case "buy":
    case "quiz":
    case "choose": {
      if (isBot) {
        await sleep(PACE.botThink);
        return botAnswer(s, req);
      }
      return waitForHuman(req);
    }
    case "debate": {
      if (isBot) return botAnswer(s, req);
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

/** Starts the first game by opening the bot setup each time the game page opens. */
export function startIfIdle() {
  if (useGame.getState().online) return;
  useGame.getState().openSetup();
}

let onlineAnswer: ((value: unknown) => void) | null = null;
export function enterOnline(answer: (value: unknown) => void) {
  ++generation;
  resolver = null;
  onlineAnswer = answer;
  useGame.setState({ online: true, awaiting: null, paused: false, banner: null, notice: null, rolling: false });
}
export function leaveOnline() {
  ++generation;
  onlineAnswer = null;
  resolver = null;
  useGame.setState({ online: false, mySeat: 0, onlineActor: null, awaiting: null });
}

// Dev-only handle for scripted screenshot checks (e.g. forcing a banner).
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __game: typeof useGame }).__game = useGame;
}
