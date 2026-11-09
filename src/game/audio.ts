// Recorded CC0 foley (Kenney) played through one Web Audio mixer. Browser only.
// Graph: voice -> bus (sfx | ui | music) -> master -> limiter -> analyser -> speakers.
// Rules never call this; the store and scene report events and this module picks the sound.

type Bus = "sfx" | "ui" | "music";

/** Sound name -> recorded variants in /public/audio. One is picked at random per play. */
const SOUNDS = {
  "dice-shake": ["dice-shake-1", "dice-shake-2", "dice-shake-3"],
  "dice-throw": ["dice-throw-1", "dice-throw-2", "dice-throw-3"],
  pawn: ["pawn-1", "pawn-2", "pawn-3"],
  step: ["step-1", "step-2"],
  coins: ["coins-handful"],
  chips: ["chips-1", "chips-2"],
  "chips-handle": ["chips-handle-1", "chips-handle-2"],
  "chips-stack": ["chips-stack"],
  wood: ["wood-heavy-1", "wood-heavy-2"],
  plate: ["plate-light"],
  bell: ["bell-heavy"],
  "paper-burst": ["paper-burst"],
  "paper-flutter": ["paper-flutter"],
  swoosh: ["swoosh"],
  click: ["ui-click"],
  "jingle-lucky": ["jingle-lucky"],
  "jingle-good": ["jingle-good"],
  "jingle-bad": ["jingle-bad"],
  "jingle-meh": ["jingle-meh"],
  "jingle-win": ["jingle-win"],
} as const;
type Sound = keyof typeof SOUNDS;

/** Mix levels (linear). Jingles are recorded much hotter than foley, so they sit far lower. */
export const MIX = {
  master: 0.8,
  bus: { sfx: 1, ui: 0.7, music: 0.8 },
  diceShake: 0.55,
  diceThrow: 0.9,
  pawn: 0.32,
  step: 0.16,
  coins: 0.5,
  chips: 0.75,
  wood: 0.45,
  plate: 0.35,
  bell: 0.5,
  paper: 0.7,
  swoosh: 0.8,
  click: 0.9,
  jingle: 0.22,
  jingleMinor: 0.15,
  /** Quiet lounge room tone under everything (synthesized, looped). */
  ambience: 0.06,
};
/** Most simultaneous voices of one sound; the oldest is cut past this. */
const VOICE_CAP = 4;
/** Random pitch spread so repeated hits never sound identical. */
const PITCH_JITTER = 0.08;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
const buses: Partial<Record<Bus, GainNode>> = {};
const raw = new Map<string, Promise<ArrayBuffer | null>>();
const buffers = new Map<string, AudioBuffer>();
const voices = new Map<Sound, AudioBufferSourceNode[]>();
let muted = false;
let decoding = false;
let shake: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
const played: string[] = [];

const files = () => Object.values(SOUNDS).flat();

/** Download the files early (no AudioContext needed); decoding waits for the first gesture. */
function prefetch() {
  for (const f of files()) {
    if (raw.has(f)) continue;
    raw.set(
      f,
      fetch(`/audio/${f}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null),
    );
  }
}

function decodeAll(c: AudioContext) {
  if (decoding) return;
  decoding = true;
  prefetch();
  for (const [f, p] of raw) {
    void p.then(async (data) => {
      if (!data) return;
      try {
        buffers.set(f, await c.decodeAudioData(data.slice(0)));
      } catch {
        /* undecodable file: that sound stays silent */
      }
    });
  }
}

/** Soft room tone: looped brown noise through a low-pass that slowly breathes, plus a faint warm hum. */
function startAmbience(c: AudioContext) {
  const bus = buses.music;
  if (!bus) return;
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    // Crossfade the ends so the loop has no click.
    const f = 2000;
    for (let i = 0; i < f; i++) { const t = i / f; d[i] = d[i]! * t + d[len - f + i]! * (1 - t); }
  }
  const src = c.createBufferSource();
  src.buffer = buf; src.loop = true; src.loopEnd = (len - 2000) / c.sampleRate;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
  const lfoGain = c.createGain(); lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(lp.frequency);
  const hum = c.createOscillator(); hum.frequency.value = 110;
  const humGain = c.createGain(); humGain.gain.value = 0.08;
  const g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(MIX.ambience, c.currentTime + 3);
  src.connect(lp).connect(g);
  hum.connect(humGain).connect(g);
  g.connect(bus);
  src.start(); lfo.start(); hum.start();
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MIX.master;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    master.connect(limiter).connect(analyser).connect(ctx.destination);
    for (const b of ["sfx", "ui", "music"] as Bus[]) {
      const g = ctx.createGain();
      g.gain.value = MIX.bus[b];
      g.connect(master);
      buses[b] = g;
    }
    startAmbience(ctx);
    decodeAll(ctx);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface PlayOpts {
  gain?: number;
  rate?: number;
  delay?: number;
  bus?: Bus;
  loop?: boolean;
  /** Seconds into the recording to start from. */
  offset?: number;
  /** Seconds to play; ends with a short fade instead of a click. */
  duration?: number;
}

function play(name: Sound, o: PlayOpts = {}) {
  const c = ac();
  if (!c || (typeof document !== "undefined" && document.hidden)) return null;
  const variants = SOUNDS[name];
  const buf = buffers.get(variants[Math.floor(Math.random() * variants.length)]!);
  const bus = buses[o.bus ?? "sfx"];
  if (!buf || !bus) return null;
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = !!o.loop;
  src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * PITCH_JITTER);
  const g = c.createGain();
  g.gain.value = o.gain ?? 1;
  if (o.duration) {
    g.gain.setValueAtTime(o.gain ?? 1, t + Math.max(0, o.duration - 0.06));
    g.gain.linearRampToValueAtTime(0, t + o.duration);
  }
  src.connect(g).connect(bus);
  const offset = Math.min(o.offset ?? 0, Math.max(0, buf.duration - 0.05));
  if (o.duration) src.start(t, offset, o.duration);
  else src.start(t, offset);

  const list = voices.get(name) ?? [];
  list.push(src);
  while (list.length > VOICE_CAP) {
    try {
      list.shift()!.stop();
    } catch {
      /* already ended */
    }
  }
  voices.set(name, list);
  src.onended = () => {
    const i = list.indexOf(src);
    if (i >= 0) list.splice(i, 1);
  };
  if (import.meta.env.DEV) played.push(name);
  return { src, gain: g };
}

function stopShake(fade = 0.06) {
  const s = shake;
  shake = null;
  if (!s || !ctx) return;
  const t = ctx.currentTime;
  s.gain.gain.setTargetAtTime(0, t, fade / 3);
  s.src.stop(t + fade + 0.05);
}

if (typeof window !== "undefined") {
  setTimeout(prefetch, 0);
  // Browsers only allow audio after a gesture: unlock and decode on the first one.
  const unlock = () => {
    ac();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

export const sfx = {
  setMuted(m: boolean) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : MIX.master, ctx.currentTime, 0.02);
  },
  /** Dice rattling in the closed hand while the throw is being charged. */
  shakeStart() {
    if (shake) return;
    const v = play("dice-shake", { gain: MIX.diceShake, loop: true });
    if (v) shake = v;
  },
  shakeStop() {
    stopShake();
  },
  /** Dice leave the hand and tumble across the felt. Bots get a short shake first. */
  diceThrow() {
    if (shake) {
      stopShake(0.04);
      play("dice-throw", { gain: MIX.diceThrow });
      return;
    }
    play("dice-shake", { gain: MIX.diceShake, offset: Math.random() * 0.5, duration: 0.4 });
    play("dice-throw", { gain: MIX.diceThrow, delay: 0.3 });
  },
  /** Coins changing hands: a handful for transfers, a couple of chips otherwise. */
  coins(n = 6) {
    if (n >= 8) {
      play("coins", { gain: MIX.coins });
      play("chips-handle", { gain: MIX.chips, delay: 0.15 });
    } else {
      play("chips", { gain: MIX.chips });
      play("chips", { gain: MIX.chips * 0.8, delay: 0.09 });
    }
  },
  /** Landmark lands: a heavy wooden slam with a bell ringing over it. */
  landmark() {
    play("wood", { gain: MIX.wood, rate: 0.8 });
    play("plate", { gain: MIX.plate, rate: 0.85, delay: 0.02 });
    play("bell", { gain: MIX.bell, delay: 0.04 });
  },
  /** Paper confetti bursting out and fluttering down. */
  confetti() {
    play("paper-burst", { gain: MIX.paper });
    play("paper-flutter", { gain: MIX.paper * 0.55, delay: 0.18 });
  },
  /** A house or hotel set down on its tile. */
  thud() {
    play("wood", { gain: MIX.wood });
    play("plate", { gain: MIX.plate });
  },
  /** Rolled a double: chips stacked plus a short lucky sting. */
  double() {
    play("chips-stack", { gain: MIX.chips * 1.2 });
    play("jingle-lucky", { gain: MIX.jingle, bus: "music", delay: 0.05 });
  },
  /** Metal pawn tapping down on the next tile. */
  hop() {
    play("pawn", { gain: MIX.pawn, rate: 1.05 });
    play("step", { gain: MIX.step });
  },
  /** Salary or a small win: a handful of coins. */
  coin() {
    play("coins", { gain: MIX.coins });
  },
  /** Bad news. `minor` is for small notices, the full sting for banners. */
  bad(minor = false) {
    play(minor ? "jingle-meh" : "jingle-bad", { gain: minor ? MIX.jingleMinor : MIX.jingle, bus: "music" });
  },
  /** Flight / jump across the board. */
  whoosh() {
    play("swoosh", { gain: MIX.swoosh, rate: 0.75 });
  },
  click() {
    play("click", { gain: MIX.click, bus: "ui" });
  },
  fanfare() {
    play("jingle-good", { gain: MIX.jingle, bus: "music" });
  },
  win() {
    play("jingle-win", { gain: MIX.jingle * 1.3, bus: "music" });
    play("coins", { gain: MIX.coins, delay: 0.4 });
  },
};

// Dev-only meter: the sandbox cannot hear, so scripted checks read peak/RMS instead.
if (import.meta.env.DEV && typeof window !== "undefined") {
  const data = new Float32Array(2048);
  (window as unknown as { __audio: unknown }).__audio = {
    sfx,
    loaded: () => buffers.size,
    total: () => files().length,
    played: () => played.splice(0),
    state: () => ctx?.state ?? "none",
    meter: () => {
      if (!analyser) return { peak: 0, rms: 0 };
      analyser.getFloatTimeDomainData(data);
      let peak = 0;
      let sum = 0;
      for (const v of data) {
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      return { peak, rms: Math.sqrt(sum / data.length) };
    },
  };
}
