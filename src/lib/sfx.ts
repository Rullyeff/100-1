/**
 * Game sound effects, synthesized with the Web Audio API (no audio files to load).
 * Presentation-only: nothing here reads or changes game state.
 */
const STORE_KEY = "100suara-sound-muted";
const listeners = new Set<() => void>();
let muted: boolean | null = null;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let musicBus: GainNode | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let musicNext = 0;
export type MusicTrack = "menu" | "game";
let musicTrack: MusicTrack = "menu";

export type Sfx = "click" | "rattle" | "throw" | "clack" | "hop" | "flip" | "chime" | "thud" | "fanfare";

export function isMuted(): boolean {
  if (muted === null) {
    try { muted = typeof window !== "undefined" && window.localStorage.getItem(STORE_KEY) === "1"; } catch { muted = false; }
  }
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try { window.localStorage.setItem(STORE_KEY, value ? "1" : "0"); } catch { /* storage unavailable */ }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.55, ctx.currentTime, 0.02);
  if (value) stopMusic(); else startMusic();
  listeners.forEach((l) => l());
}

export function subscribeMuted(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = isMuted() ? 0 : 0.55;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // Music bus with a short room echo so the plucked strings ring a little.
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.19;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2200;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    musicBus.connect(echo);
    echo.connect(damp).connect(feedback).connect(echo);
    damp.connect(wet).connect(master);
  }
  // iPhone/iPad report "interrupted" after calls or app switches; resume from any non-running state.
  if (ctx.state !== "running") void ctx.resume().catch(() => {});
  return ctx;
}

/** Browsers only allow sound after a user gesture; call this from a pointer/keyboard handler. */
export function unlockAudio() { audio(); startMusic(); }

function tone(c: AudioContext, at: number, freq: number, dur: number, vol: number, type: OscillatorType = "sine", endFreq?: number, dest: AudioNode = master!) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function burst(c: AudioContext, at: number, dur: number, vol: number, freq: number, q = 1, endFreq?: number, dest: AudioNode = master!) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, at);
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.01, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

/** Plays a sound effect; `strength` (0..1) scales impacts, `step` raises pawn hop pitch. */
export function play(name: Sfx, opts: { strength?: number; step?: number } = {}) {
  if (isMuted()) return;
  const c = audio();
  if (!c || !master || c.state !== "running") return;
  const t = c.currentTime + 0.005;
  const s = opts.strength ?? 1;
  switch (name) {
    case "click": // wooden board-game button tap
      tone(c, t, 420, 0.07, 0.22, "triangle", 260);
      burst(c, t, 0.035, 0.12, 2400, 2);
      break;
    case "rattle": // dice shaken in the hand
      for (let i = 0; i < 7; i++) {
        const at = t + i * 0.085 + Math.random() * 0.03;
        burst(c, at, 0.04, 0.16 + Math.random() * 0.1, 2600 + Math.random() * 1600, 4);
        tone(c, at, 900 + Math.random() * 500, 0.03, 0.05, "square");
      }
      break;
    case "throw": // dice leaving the hand
      burst(c, t, 0.32, 0.12, 500, 0.8, 2600);
      break;
    case "clack": // dice hitting the tray
      burst(c, t, 0.06, 0.32 * s, 1900, 3);
      tone(c, t, 190, 0.12, 0.28 * s, "triangle", 90);
      tone(c, t, 1300 + Math.random() * 400, 0.04, 0.08 * s, "square");
      break;
    case "hop": { // pawn landing on a space
      const base = 520 + Math.min(opts.step ?? 0, 10) * 22;
      tone(c, t, base, 0.09, 0.2, "triangle", base * 0.62);
      burst(c, t, 0.03, 0.08, 3000, 2);
      break;
    }
    case "flip": // card turned over
      burst(c, t, 0.18, 0.18, 900, 0.9, 4200);
      burst(c, t + 0.14, 0.05, 0.16, 1800, 2);
      break;
    case "chime": // correct answer / votes gained
      [1046.5, 1318.5, 1568].forEach((f, i) => {
        tone(c, t + i * 0.09, f, 0.5, 0.16, "sine");
        tone(c, t + i * 0.09, f * 2, 0.25, 0.04, "sine");
      });
      break;
    case "thud": // penalty / surprise loss
      tone(c, t, 150, 0.38, 0.4, "sine", 52);
      burst(c, t, 0.14, 0.14, 260, 1.2);
      tone(c, t + 0.12, 220, 0.28, 0.08, "triangle", 160);
      break;
    case "fanfare": // game over
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const at = t + i * 0.13;
        tone(c, at, f, i === 3 ? 0.9 : 0.24, 0.13, "triangle");
        tone(c, at, f * 1.5, i === 3 ? 0.7 : 0.18, 0.04, "sine");
      });
      break;
  }
}

/* ---------- Background music: upbeat, energetic synth-pop loops ---------- */

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Bright chiptune-style lead: square + detuned saw with a quick pluck envelope. */
function lead(c: AudioContext, at: number, midi: number, dur: number, vol: number) {
  const f = midiHz(midi);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(5200, at);
  filter.frequency.exponentialRampToValueAtTime(2200, at + Math.max(0.05, dur));
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.setValueAtTime(vol * 0.8, at + Math.max(0.02, dur - 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  filter.connect(g).connect(musicBus!);
  ([["square", 1], ["sawtooth", 1.006]] as const).forEach(([type, m]) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f * m;
    o.connect(filter);
    o.start(at);
    o.stop(at + dur + 0.05);
  });
}

/** Punchy synth bass. */
function synthBass(c: AudioContext, at: number, midi: number, dur: number, vol: number) {
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, at);
  filter.frequency.exponentialRampToValueAtTime(300, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  filter.connect(g).connect(musicBus!);
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = midiHz(midi);
  o.connect(filter);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** Short chord stab for off-beats. */
function stab(c: AudioContext, at: number, notes: number[], dur: number, vol: number) {
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2600;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  filter.connect(g).connect(musicBus!);
  notes.forEach((m) => {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = midiHz(m);
    o.connect(filter);
    o.start(at);
    o.stop(at + dur + 0.05);
  });
}

function kick(c: AudioContext, at: number, vol: number) { tone(c, at, 150, 0.22, vol, "sine", 45, musicBus!); }
function snare(c: AudioContext, at: number, vol: number) {
  burst(c, at, 0.14, vol, 2200, 0.7, undefined, musicBus!);
  tone(c, at, 220, 0.08, vol * 0.4, "triangle", 160, musicBus!);
}
function hat(c: AudioContext, at: number, vol: number) { burst(c, at, 0.035, vol, 8000, 2, undefined, musicBus!); }

type Chord = { bass: number; tones: number[] };
const CH: Record<string, Chord> = {
  C: { bass: 36, tones: [60, 64, 67] },
  G: { bass: 43, tones: [59, 62, 67] },
  Am: { bass: 45, tones: [60, 64, 69] },
  F: { bass: 41, tones: [60, 65, 69] },
  Dm: { bass: 38, tones: [62, 65, 69] },
  Em: { bass: 40, tones: [59, 64, 67] },
};
// Eighth-note melodies: a number is a new note, null holds the previous one, 0 is a rest.
const _ = null;
type Bar = { chord: string; lead: (number | null)[] };
// Menu: upbeat anthem in C major (I–V–vi–IV), about 140 bpm.
const MENU_BARS: Bar[] = [
  { chord: "C", lead: [72, _, 76, _, 79, _, 76, 79] },
  { chord: "G", lead: [79, _, 81, 79, 74, _, 71, _] },
  { chord: "Am", lead: [72, _, 76, _, 81, _, 79, 76] },
  { chord: "F", lead: [77, _, 76, 74, 72, _, 74, _] },
  { chord: "C", lead: [76, 76, 79, _, 84, _, 83, 81] },
  { chord: "G", lead: [79, _, 83, _, 86, _, 83, _] },
  { chord: "F", lead: [81, _, 79, 77, 76, _, 77, 79] },
  { chord: "G", lead: [79, _, 81, 83, 84, _, 0, 0] },
];
// In-game: same energy, a little lighter so dice and card sounds stay clear.
const GAME_BARS: Bar[] = [
  { chord: "Am", lead: [69, _, 72, _, 76, _, 72, _] },
  { chord: "F", lead: [72, _, 77, _, 76, _, 72, _] },
  { chord: "C", lead: [72, _, 76, _, 79, _, 76, _] },
  { chord: "G", lead: [74, _, 79, _, 83, _, 79, _] },
  { chord: "Am", lead: [76, _, 79, 76, 81, _, 79, _] },
  { chord: "F", lead: [77, _, 76, 74, 72, _, 74, _] },
  { chord: "Dm", lead: [74, _, 77, _, 81, _, 77, _] },
  { chord: "G", lead: [79, _, 77, 76, 74, _, 0, 0] },
];
type Song = { beat: number; vol: number; bars: Bar[]; calm: boolean };
const SONGS: Record<MusicTrack, Song> = {
  menu: { beat: 0.214, vol: 0.7, bars: MENU_BARS, calm: false }, // about 140 bpm
  game: { beat: 0.24, vol: 0.45, bars: GAME_BARS, calm: true }, // about 125 bpm
};

function playBeat(c: AudioContext, t: number, step: number, song: Song) {
  const BEAT = song.beat;
  const barIdx = Math.floor(step / 8) % song.bars.length;
  const i = step % 8;
  const bar = song.bars[barIdx]!;
  const chord = CH[bar.chord]!;
  const note = bar.lead[i];
  const k = song.calm ? 0.75 : 1;

  if (note) {
    let holds = 0;
    while (i + holds + 1 < 8 && bar.lead[i + holds + 1] === null) holds++;
    lead(c, t, note, BEAT * (holds + 1) * 0.92, 0.05 * k);
  }
  // Driving eighth-note bass, octave bounce.
  synthBass(c, t, chord.bass + (i % 2 ? 12 : 0), BEAT * 0.9, 0.16 * k);
  if (i % 2 === 1) stab(c, t, chord.tones, BEAT * 0.5, 0.02 * k);
  // Four-on-the-floor kick, backbeat snare, hats on every eighth.
  if (i % 2 === 0) kick(c, t, 0.38 * k);
  if (i === 2 || i === 6) snare(c, t, 0.14 * k);
  hat(c, t, (i % 2 ? 0.05 : 0.03) * k);
}

function scheduleMusic() {
  const c = ctx;
  if (!c || !musicBus || c.state !== "running") return;
  if (musicNext < c.currentTime) musicNext = c.currentTime + 0.05;
  while (musicNext < c.currentTime + 0.3) {
    const song = SONGS[musicTrack];
    playBeat(c, musicNext, musicStep, song);
    musicNext += song.beat;
    musicStep++;
  }
}

/** Starts the looping background music (needs a prior user gesture; no-op when muted). */
export function startMusic() {
  if (musicTimer !== null || isMuted() || typeof document === "undefined" || document.hidden) return;
  const c = audio();
  if (!c || !musicBus) return;
  musicNext = c.currentTime + 0.15;
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
  musicBus.gain.linearRampToValueAtTime(SONGS[musicTrack].vol, c.currentTime + 2.5);
  musicTimer = window.setInterval(scheduleMusic, 60);
  scheduleMusic();
}

/** Switches between the menu tune and the calmer in-game tune, crossfading briefly. */
export function setMusicTrack(track: MusicTrack) {
  if (track === musicTrack) return;
  musicTrack = track;
  musicStep = 0;
  if (!ctx || !musicBus || musicTimer === null) return;
  const now = ctx.currentTime;
  musicNext = now + 0.6;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(musicBus.gain.value, now);
  musicBus.gain.linearRampToValueAtTime(0, now + 0.5);
  musicBus.gain.linearRampToValueAtTime(SONGS[track].vol, now + 2.5);
}

export function stopMusic() {
  if (musicTimer !== null) window.clearInterval(musicTimer);
  musicTimer = null;
  if (ctx && musicBus) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
}

/** One-time global hooks: unlock audio on the first gesture and tap sound for buttons and links. */
export function installSfx() {
  if (typeof window === "undefined") return () => {};
  // Safari 16.4+: play through the media channel so the iPhone silent switch doesn't mute the game.
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch { /* unsupported */ }
  const unlock = () => unlockAudio();
  const onClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("button, a[href], [role='tab'], [role='button']");
    if (!el || el.closest("[data-sfx='off']") || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;
    play("click");
  };
  const onVisibility = () => {
    if (document.hidden) stopMusic();
    else if (ctx) startMusic();
  };
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
  window.addEventListener("touchend", unlock, { capture: true });
  window.addEventListener("click", onClick, { capture: true });
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    stopMusic();
    window.removeEventListener("pointerdown", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
    window.removeEventListener("touchend", unlock, { capture: true });
    window.removeEventListener("click", onClick, { capture: true });
  };
}
