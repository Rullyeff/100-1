import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useFullscreen } from "./useFullscreen";
import { Link } from "@tanstack/react-router";
import { useState as useExitState } from "react";
import { createPortal } from "react-dom";
import { Check, Home, LogOut, Info, X, Gauge, Landmark, Maximize, Minimize, Pause, Play, RotateCcw, Scale, Shield, Trophy, Volume2, VolumeX, Vote } from "lucide-react";
import avKamu from "@/assets/avatars/kamu.jpg";
import pa1 from "@/assets/avatars/avatar-1.webp";
import pa2 from "@/assets/avatars/avatar-2.webp";
import pa3 from "@/assets/avatars/avatar-3.webp";
import pa4 from "@/assets/avatars/avatar-4.webp";
import pa5 from "@/assets/avatars/avatar-5.webp";
import pa6 from "@/assets/avatars/avatar-6.webp";
import pa7 from "@/assets/avatars/avatar-7.webp";
import pa8 from "@/assets/avatars/avatar-8.webp";
import pa9 from "@/assets/avatars/avatar-9.webp";
import avBudi from "@/assets/avatars/budi.jpg";
import avSari from "@/assets/avatars/sari.jpg";
import avJoko from "@/assets/avatars/joko.jpg";
import avRina from "@/assets/avatars/rina.jpg";
import { AREAS, GATE_REQUIREMENT, MAX_PLOTS, PLEDGE, TILES, segmentOf } from "../sim/board";
import { fmt } from "../sim/format";
import { pledgedVotes, ranking, validVotes, type GameState } from "../sim/state";
import { useGame } from "../store";
import { sfx } from "../audio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SkipForward } from "lucide-react";
import { useCinematic, milestone } from "../scene/cinematic";
import { DECK_NAMES, QUESTIONS } from "../sim/quiz";
import { PLAYER_NAMES, type BotLevel, type BotSetup, type BotStyle } from "../sim/state";

const PLAYER_BG = ["bg-player-1", "bg-player-2", "bg-player-3", "bg-player-4", "bg-player-5"];
const PLAYER_TEXT = [
  "text-player-1",
  "text-player-2",
  "text-player-3",
  "text-player-4",
  "text-player-5",
];
const RANK_LABEL = ["1st", "2nd", "3rd", "4th", "5th"];
const BASE_AVATARS = [avKamu, avJoko, avBudi, avSari, avRina];
/** 10 choices for the human player's avatar; index 0 is the default. */
export const AVATAR_CHOICES = [avKamu, pa1, pa2, pa3, pa4, pa5, pa6, pa7, pa8, pa9];
function avatarOf(seat: number) {
  const s = useGame.getState();
  if (seat === s.mySeat) return AVATAR_CHOICES[s.avatar] ?? BASE_AVATARS[seat];
  return BASE_AVATARS[seat];
}
const AVATARS = new Proxy([] as string[], { get: (_t, k) => (typeof k === "string" && /^\d+$/.test(k) ? avatarOf(Number(k)) : undefined) });
const RANK_STYLE = [
  "bg-gold text-primary-foreground",
  "bg-paper text-paper-foreground",
  "bg-gold-deep text-paper",
  "bg-secondary text-secondary-foreground",
  "bg-secondary text-secondary-foreground",
];

/** Short status of where a player is in the 100 SUARA journey. */
function phaseLabel(game: GameState, index: number): string {
  const p = game.players[index]!;
  if (p.dormant)
    return p.dormantTurns ? `Mati Suri · ${p.dormantTurns} giliran` : "Tantangan Bangkit";
  if (p.phase === "ring")
    return p.ready
      ? "Siap masuk Gerbang"
      : `Area ${p.areaTokens.filter(Boolean).length}/5 · ${Math.min(p.cash + p.eligibility, GATE_REQUIREMENT)}/${GATE_REQUIREMENT}`;
  if (p.phase === "gate") {
    const seg = segmentOf(p.pos);
    return `Gerbang · ${seg.seg === "gate" ? seg.g + 1 : 0}/5`;
  }
  if (p.phase === "done") return "Putaran tuntas";
  return `Pentagon · Putaran ${Math.min(p.laps + 1, game.lapGoal)}`;
}

export function Hud() {
  useGame((s) => s.avatar);
  useEffect(() => { const v = Number(localStorage.getItem("my-avatar")); if (v > 0 && v < AVATAR_CHOICES.length) useGame.getState().setAvatar(v); }, []);
  return (
    <div className="game-ui-theme pointer-events-none absolute inset-0 z-30 select-none font-sans">
      <div className="player-topbar" aria-label="Pemain">
        {[0, 1, 2, 3, 4].map((i) => (
          <PlayerPanel key={i} index={i} />
        ))}
      </div>
      <TopCenter />
      <Controls />
      <BottomCenter />
      <ClaimDialog />
      <ChoiceDialog />
      <QuizDialog />
      <DebateDialog />
      <BannerFx />
      <GameOver />
      <CinematicCaption />
      <PauseOverlay />
      <BotSetupDialog />
    </div>
  );
}

function PlayerPanel({ index }: { index: number }) {
  const mySeat = useGame((s) => s.mySeat);
  const game = useGame((s) => s.game);
  const p = game.players[index];
  if (!p || p.absent) return null;
  const rank = ranking(game).indexOf(index);
  const isTurn = game.turn === index && !game.over;
  const votes = validVotes(game, index);

  return (
    <div
      className={cn(
        "player-panel",
        `player-seat-${index}`,
        isTurn && "player-panel-active",
        p.bankrupt && "opacity-45 grayscale",
      )}
      aria-label={`${p.name}, ${fmt(validVotes(game, index))} suara${isTurn ? ", sedang bermain" : ""}`}
      title={`${AREAS[index]?.name} · ${phaseLabel(game, index)} · Tangan ${fmt(p.cash)}${p.eligibility > 0 ? ` · Kelayakan +${p.eligibility}` : ""}`}
    >
      <div className="player-avatar relative shrink-0">
          <img
            src={AVATARS[index]}
            alt={p.name}
            width={256}
            height={256}
            className="rounded-full object-cover"
          />
        <span key={rank} className="player-rank font-display">{rank + 1}</span>
      </div>
      <div className="player-summary min-w-0">
        <div className="flex min-w-0 items-center gap-1">
          <span className="player-name truncate font-display">
            {p.name}
          </span>
          {p.shield && <Shield className="h-3 w-3 shrink-0 text-success" aria-label="Dukungan tokoh" />}
        </div>
        {p.bankrupt ? (
          <div className="player-votes font-display">GUGUR</div>
        ) : (
          <>
            <VoteCount value={votes} />
            <div className="player-progress" aria-label={`Token Area ${p.areaTokens.filter(Boolean).length} dari 5`}>
              {p.areaTokens.map((earned, area) => (
                <span
                  key={area}
                  title={`${AREAS[area]?.name}: ${earned ? "diperoleh" : "belum"}`}
                  className={cn("player-progress-seg", earned && cn("is-earned", PLAYER_BG[area]))}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <span className="player-turn-label">
        {isTurn ? (
          <span className="player-turn-pill">
            <span className="player-turn-dot" aria-hidden />
            {index === mySeat ? "GILIRANMU" : "GILIRAN"}
          </span>
        ) : (
          AREAS[index]?.name
        )}
      </span>
    </div>
  );
}

/** Vote total that counts up/down smoothly and floats a +N / −N chip on change. */
function VoteCount({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [delta, setDelta] = useState<{ v: number; id: number } | null>(null);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    setDelta({ v: value - from, id: Date.now() });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const dur = 600;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  useEffect(() => {
    if (!delta) return;
    const t = window.setTimeout(() => setDelta(null), 1400);
    return () => window.clearTimeout(t);
  }, [delta]);

  return (
    <div className="player-votes flex items-center gap-1" title="Suara sah (di tangan + jaminan)">
      <Vote className="h-3 w-3 shrink-0 opacity-60" />
      <span key={`n${delta?.id ?? 0}`} className={cn("font-display", delta && "player-votes-bump")}>
        {fmt(shown)}
      </span>
      {delta && (
        <span
          key={`d${delta.id}`}
          className={cn("player-delta font-display", delta.v > 0 ? "is-up" : "is-down")}
          aria-hidden
        >
          {delta.v > 0 ? `+${delta.v}` : `−${Math.abs(delta.v)}`}
        </span>
      )}
    </div>
  );
}

type NoticeData = { id: number; text: string; tone: "good" | "bad" | "info"; player?: number | undefined; ms: number };

/** Splits "Label: +2 Suara · Area" into a short label, the main line, a meta tail and a vote amount. */
function parseNotice(text: string) {
  let label = "";
  let body = text;
  const colon = text.indexOf(": ");
  if (colon > 0 && colon <= 32) {
    label = text.slice(0, colon);
    body = text.slice(colon + 2);
  }
  let amount = "";
  const m = body.match(/^([+−-])\s?(\d+) Suara/);
  if (m) {
    amount = `${m[1] === "+" ? "+" : "−"}${m[2]}`;
    body = body.slice(m[0].length).replace(/^\s*·\s*/, "");
  }
  const parts = body.split(" · ");
  return { label, main: parts[0] ?? "", meta: parts.slice(1).join(" · "), amount };
}

function NoticeToast({ notice }: { notice: NoticeData }) {
  const { label, main, meta, amount } = parseNotice(notice.text);
  const Icon = notice.tone === "good" ? Check : notice.tone === "bad" ? X : Info;
  const style = {
    "--notice-ms": `${notice.ms}ms`,
    ...(notice.player !== undefined ? { "--notice-seat": `var(--player-${notice.player + 1})` } : {}),
  } as CSSProperties;
  return (
    <div className="notice-toast" data-tone={notice.tone} style={style} role="status" aria-live="polite">
      <span className="notice-mark">
        {notice.player !== undefined ? (
          <img src={AVATARS[notice.player]} alt="" className="notice-avatar" />
        ) : (
          <Icon className="h-5 w-5" strokeWidth={2.6} />
        )}
        {notice.player !== undefined && (
          <span className="notice-tone-dot">
            <Icon className="h-2.5 w-2.5" strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span className="notice-copy">
        {label && <span className="notice-label">{label}</span>}
        {main && <span className="notice-main">{main}</span>}
        {!main && !label && <span className="notice-main">{notice.text}</span>}
        {meta && <span className="notice-meta">{meta}</span>}
      </span>
      {amount && (
        <span className="notice-amount">
          {amount}
          <small>suara</small>
        </span>
      )}
      <span className="notice-timer" aria-hidden />
    </div>
  );
}

function TopCenter() {
  const round = useGame((s) => s.game.round);
  const notice = useGame((s) => s.notice);
  const bank = useGame((s) => s.game.stock.reduce((a, b) => a + b, 0));
  return (
    <>
      <div className="game-panel absolute bottom-14 left-1/2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap px-4 py-1 font-display text-xs text-foreground sm:bottom-16 sm:text-sm short:bottom-10 portrait:bottom-[9.5rem] sm:portrait:bottom-44">
        <span>
          Ronde <span className="text-gold">{round}</span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span title="Suara yang belum dibagikan">
          Stok suara <span className="text-gold">{bank}</span>/100
        </span>
      </div>
      <div className="absolute left-1/2 top-[108px] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2 short:top-[60px] short:w-[min(44vw,360px)] short:gap-1">
        {notice && <NoticeToast key={notice.id} notice={notice} />}
      </div>
    </>
  );
}

function Controls() {
  const online = useGame((s) => s.online);
  const fast = useGame((s) => s.fast);
  const muted = useGame((s) => s.muted);
  const toggleFast = useGame((s) => s.toggleFast);
  const toggleMute = useGame((s) => s.toggleMute);
  const paused = useGame((s) => s.paused);
  const togglePause = useGame((s) => s.togglePause);
  const btn = "btn-soft pointer-events-auto flex h-10 w-10 items-center justify-center short:h-8 short:w-8 [&_svg]:short:h-4 [&_svg]:short:w-4";
  const fullscreen = useFullscreen();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== "KeyF" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      fullscreen.toggle();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [fullscreen.toggle]);
  const fullLabel = fullscreen.full ? "Keluar layar penuh (F)" : "Layar penuh (F)";
  return (
    <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 sm:right-4 short:right-2 short:gap-1.5">
      {fullscreen.supported && (
        <button
          className={cn(btn, fullscreen.full && "bg-gold text-primary-foreground")}
          onClick={fullscreen.toggle}
          aria-label={fullLabel}
          aria-pressed={fullscreen.full}
          title={fullLabel}
        >
          {fullscreen.full ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
      )}
      <button
        disabled={online}
        className={cn(btn, paused && "bg-gold text-primary-foreground")}
        onClick={togglePause}
        aria-label={paused ? "Lanjutkan" : "Jeda"}
        title={paused ? "Lanjutkan" : "Jeda"}
      >
        {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
      </button>
      <button
        className={cn(btn, fast && "bg-gold text-primary-foreground")}
        onClick={toggleFast}
        aria-label="Mode cepat"
        title="Mode cepat"
      >
        <Gauge className="h-5 w-5" />
      </button>
      <button
        className={btn}
        onClick={toggleMute}
        aria-label={muted ? "Nyalakan suara" : "Matikan suara"}
        title="Suara"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
      <button
        disabled={online}
        className={btn}
        onClick={() => useGame.getState().openSetup()}
        aria-label="Main baru"
        title="Main baru"
      >
        <RotateCcw className="h-5 w-5" />
      </button>
      <ExitButton className={btn} />
    </div>
  );
}

function ExitButton({ className }: { className: string }) {
  const [open, setOpen] = useExitState(false);
  return (
    <>
      <button className={className} onClick={() => { setOpen(true); useGame.setState({ paused: true }); }} aria-label="Akhiri permainan" title="Akhiri permainan">
        <LogOut className="h-5 w-5" />
      </button>
      {open && createPortal(
        <div className="game-ui-theme pointer-events-auto fixed inset-0 z-[100] grid place-items-center bg-background/60 p-4 backdrop-blur-sm">
          <div className="card-flip-in w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center text-card-foreground shadow-2xl">
            <h2 className="font-display text-2xl">Akhiri permainan?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Progres permainan ini tidak akan disimpan.</p>
            <div className="mt-5 grid gap-2">
              <Link to="/" className="btn-gold flex items-center justify-center gap-2 py-3"><Home className="h-4 w-4" /> Kembali ke Beranda</Link>
              <button className="rounded-xl border border-border py-2.5 font-semibold hover:bg-muted" onClick={() => { setOpen(false); useGame.getState().openSetup(); }}>Main Baru</button>
              <button className="py-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => { setOpen(false); useGame.setState({ paused: false }); }}>Lanjutkan Main</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function BottomCenter() {
  const online = useGame((s) => s.online);
  const actor = useGame((s) => s.onlineActor);
  const actorName = useGame((s) => s.game.players[actor ?? s.game.turn]?.name);
  const cinematic = useCinematic((s) => s.event);
  const awaiting = useGame((s) => s.awaiting);
  const turnName = useGame((s) => s.game.players[s.game.turn]!.name);
  const isBotTurn = useGame((s) => s.game.players[s.game.turn]!.isBot);
  const over = useGame((s) => s.game.over);
  if (over || cinematic) return null;
  return (
    <div className="absolute left-1/2 top-[57%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap short:top-auto short:bottom-[5rem] short:translate-y-0">
      {awaiting?.kind === "roll" ? (
        <RollButton />
      ) : (
        (isBotTurn || online) && (
          <div className="game-panel px-4 py-2 font-display text-sm text-muted-foreground sm:text-base">
            Giliran {online ? actorName : turnName}…
          </div>
        )
      )}
    </div>
  );
}

/** Hold to charge, release to throw. The gauge ping-pongs; power only changes how wild the dice fly. */
const GAUGE_PERIOD = 1.1;
const TAP_MS = 140;
const TAP_POWER = 0.55;

/** Light haptic tap on phones; silently ignored where vibration is unsupported. */
function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

function RollButton() {
  const throwDice = useGame((s) => s.throwDice);
  const fill = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const st = useRef({ active: false, start: 0, power: 0, raf: 0, step: 0 });
  const beginRef = useRef<() => void>(() => {});

  useEffect(() => {
    const s = st.current;
    const tick = () => {
      const t = (performance.now() - s.start) / 1000 / GAUGE_PERIOD;
      const ph = t % 2;
      s.power = ph < 1 ? ph : 2 - ph;
      const step = s.power > 0.97 ? 4 : Math.floor(s.power * 4);
      if (step !== s.step) { s.step = step; buzz(step >= 4 ? 14 : 6); }
      if (fill.current) fill.current.style.width = `${Math.round(s.power * 100)}%`;
      s.raf = requestAnimationFrame(tick);
    };
    const begin = () => {
      if (s.active) return;
      s.active = true;
      s.start = performance.now();
      s.step = 0;
      buzz(10);
      if (label.current) label.current.textContent = "LEPAS!";
      sfx.shakeStart();
      tick();
    };
    const release = () => {
      if (!s.active) return;
      s.active = false;
      cancelAnimationFrame(s.raf);
      const held = performance.now() - s.start;
      buzz([18, 40, 12 + Math.round(s.power * 28)]);
      throwDice(held < TAP_MS ? TAP_POWER : s.power);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        begin();
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && release();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    beginRef.current = begin;
    return () => {
      cancelAnimationFrame(s.raf);
      sfx.shakeStop();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [throwDice]);

  return (
    <div className="pointer-events-auto flex animate-pop-in flex-col items-center gap-2 short:gap-1">
      <div className="card-frame w-48 p-1.5 sm:w-60 short:w-36 short:p-1">
        <div className="relative h-3 overflow-hidden rounded-full bg-background/80 sm:h-4 short:h-2">
          <div
            ref={fill}
            className="h-full w-0 rounded-full bg-gradient-to-r from-good via-gold to-bad"
          />
          <div className="absolute inset-0 flex justify-between px-[12%]">
            {[0, 1, 2, 3].map((k) => (
              <span key={k} className="h-full w-px bg-foreground/30" />
            ))}
          </div>
        </div>
      </div>
      <button
        className="btn-gold relative touch-none select-none overflow-hidden px-7 py-2.5 text-lg sm:px-10 sm:py-3 sm:text-2xl short:px-6 short:py-1.5 short:text-base"
        onPointerDown={(e) => {
          e.preventDefault();
          beginRef.current();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span ref={label}>LEMPAR DADU</span>
        <span className="animate-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-paper/50 [animation-iteration-count:infinite] [animation-duration:2.4s]" />
      </button>
      <span className="game-panel px-3 py-0.5 text-[11px] text-muted-foreground sm:text-xs short:hidden">
        Tahan untuk isi tenaga, lepas untuk melempar
      </span>
    </div>
  );
}

function BannerFx() {
  const banner = useGame((s) => s.banner);
  if (!banner) return null;
  if (milestone(banner.title, banner.player, useGame.getState().game)) return null;
  const bad = banner.tone === "bad";
  return (
    <div
      key={banner.id}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      <div className={cn("animate-flash absolute inset-0", bad ? "bg-bad/40" : "bg-gold/40")} />
      <div
        className="animate-rays absolute left-1/2 top-1/2 h-[170vmax] w-[170vmax] opacity-35"
        style={{
          background: `repeating-conic-gradient(from 0deg, var(--${bad ? "bad" : "gold"}) 0deg 7deg, transparent 7deg 22deg)`,
          maskImage: "radial-gradient(circle, black 0%, transparent 40%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 40%)",
        }}
      />
      <div className="animate-ribbon-in relative w-full overflow-hidden border-y-2 border-gold bg-background/95 py-3 shadow-2xl sm:py-5">
        <div className="animate-shine pointer-events-none absolute inset-y-0 left-0 w-1/5 bg-gold/25" />
        <div className="relative flex items-center justify-center gap-3 px-4 sm:gap-5">
          {banner.player !== undefined && (
            <div className="ring-frame shrink-0 animate-pop-in">
              <img
                src={AVATARS[banner.player]!}
                alt=""
                width={256}
                height={256}
                className={cn(
                  "h-12 w-12 rounded-full object-cover sm:h-20 sm:w-20",
                  PLAYER_BG[banner.player]!,
                )}
              />
            </div>
          )}
          <div className="text-center">
            <div
              className={cn(
                "animate-banner-in font-display text-4xl leading-none tracking-wide sm:text-7xl",
                bad ? "text-bad text-outline" : "text-gold-gradient drop-shadow-lg",
              )}
            >
              {banner.title}
            </div>
            <div className="mt-1 animate-pop-in text-sm font-bold text-foreground sm:text-lg">
              {banner.text}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CinematicCaption() {
  const event = useCinematic((s) => s.event);
  const skip = useCinematic((s) => s.skip);
  if (!event) return null;
  return (
    <div
      className="absolute inset-x-0 bottom-[19%] flex flex-col items-center gap-2 px-4 sm:bottom-[8%]"
      data-cinematic={event.id}
    >
      <div className="max-w-full border-y border-gold bg-background/90 px-5 py-2 text-center">
        <div className="font-display text-2xl text-gold sm:text-4xl">{event.title}</div>
        <div className="max-w-[480px] text-sm text-foreground">{event.text}</div>
      </div>
      <Button variant="secondary" size="sm" onClick={skip} className="pointer-events-auto">
        <SkipForward />
        Lewati
      </Button>
    </div>
  );
}

function PauseOverlay() {
  const paused = useGame((s) => s.paused);
  const over = useGame((s) => s.game.over);
  const togglePause = useGame((s) => s.togglePause);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "KeyP" || e.code === "Escape") useGame.getState().togglePause();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  if (!paused || over) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="paper-card animate-pop-in w-full max-w-xs overflow-hidden text-center">
        <div className="bg-gold px-5 py-3 text-primary-foreground">
          <div className="font-display text-2xl">Permainan Dijeda</div>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-sm text-muted-foreground">
            Giliran berhenti sementara. Tekan <b>P</b> atau <b>Esc</b> untuk lanjut.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="btn-gold h-auto px-5 py-2.5 text-lg"
              onClick={() => {
                sfx.click();
                togglePause();
              }}
            >
              <Play className="h-5 w-5" />
              Lanjutkan
            </Button>
            <Button
              variant="secondary"
              className="btn-soft h-auto px-5 py-2 text-base"
              onClick={() => useGame.getState().openSetup()}
            >
              <RotateCcw className="h-4 w-4" />
              Main Baru
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClaimDialog() {
  const awaiting = useGame((s) => s.awaiting);
  const game = useGame((s) => s.game);
  const answer = useGame((s) => s.answer);
  if (awaiting?.kind !== "buy") return null;
  const p = game.players[awaiting.player]!;
  const mine = game.owners.filter(
    (o, i) => o === awaiting.player && TILES[i]!.kind === "plot",
  ).length;
  return (
    <div className="game-dialog pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4">
      <div className="paper-card card-flip-in w-full max-w-sm overflow-hidden">
        <div className="bg-gold px-5 py-3 text-center text-primary-foreground">
          <div className="text-xs font-extrabold uppercase tracking-widest">Pentagon</div>
          <div className="font-display text-2xl">Klaim wilayah ini?</div>
        </div>
        <div className="space-y-3 p-5 text-center">
          <p className="text-sm">
            Jaminkan <b>{fmt(PLEDGE)}</b> dan pasang token areamu. Suara jaminan tetap dihitung
            sebagai suara sah selama wilayah ini milikmu.
          </p>
          <p className="text-xs opacity-70">
            Suara di tangan {fmt(p.cash)} · Wilayahmu {mine}/{MAX_PLOTS} · Sisa tangan setelah klaim
            minimal 5 suara
          </p>
          <div className="flex flex-col gap-2">
            <Button
              className="btn-gold h-auto px-5 py-2.5 text-lg"
              onClick={() => {
                sfx.click();
                answer(0);
              }}
            >
              Klaim · {fmt(PLEDGE)}
            </Button>
            <Button
              variant="secondary"
              className="btn-soft h-auto px-5 py-2 text-base"
              onClick={() => answer(-1)}
            >
              Lewati
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChoiceDialog() {
  const awaiting = useGame((s) => s.awaiting);
  const answer = useGame((s) => s.answer);
  if (awaiting?.kind !== "choose") return null;
  return (
    <div className="game-dialog pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4">
      <div className="paper-card card-flip-in max-h-[85dvh] w-full max-w-sm overflow-y-auto">
        <div className="bg-gold px-5 py-3 text-center text-primary-foreground">
          <div className="font-display text-2xl">{awaiting.title}</div>
        </div>
        <div className="space-y-3 p-5">
          <p className="whitespace-pre-line text-center text-sm">{awaiting.text}</p>
          <div className="flex flex-col gap-2">
            {awaiting.options.map((o, i) => (
              <Button
                key={i}
                variant="secondary"
                className="h-auto whitespace-normal px-4 py-2 text-left text-sm"
                onClick={() => {
                  sfx.click();
                  answer(i);
                }}
              >
                {o}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizDialog() {
  const awaiting = useGame((s) => s.awaiting);
  const answer = useGame((s) => s.answer);
  if (awaiting?.kind !== "quiz") return null;
  return (
    <QuizCard
      key={`${awaiting.player}:${awaiting.deck}:${awaiting.question}:${awaiting.stake}`}
      player={awaiting.player}
      deck={awaiting.deck}
      question={awaiting.question}
      stake={awaiting.stake}
      tag={awaiting.tag}
      onAnswer={answer}
    />
  );
}

const DECK_ICONS = { aspirasi: Vote, demokrasi: Scale, pentagon: Landmark } as const;
/** Brief pause that shows the chosen option before the answer is sent. */
const QUIZ_PICK_MS = 420;
/** Card flip-away before the dialog unmounts. */
const QUIZ_CLOSE_MS = 340;

function QuizCard({
  player,
  deck,
  question,
  stake,
  tag,
  onAnswer,
}: {
  player: number;
  deck: keyof typeof DECK_ICONS;
  question: number;
  stake: string;
  tag?: string | undefined;
  onAnswer: (value: number) => void;
}) {
  const name = useGame((s) => s.game.players[player]?.name ?? "");
  const [picked, setPicked] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const q = QUESTIONS[deck][question]!;
  const Icon = DECK_ICONS[deck];
  const areaIndex = q.area ? AREAS.findIndex((a) => a.key === q.area) : -1;
  const accent = areaIndex >= 0 ? `var(--city-player-${areaIndex + 1})` : undefined;
  const chips = stake.split("·").map((s) => s.trim()).filter(Boolean);
  if (tag && !chips.includes(tag)) chips.unshift(tag);
  useEffect(() => {
    if (picked === null) return;
    const c = setTimeout(() => setClosing(true), QUIZ_PICK_MS);
    const t = setTimeout(() => onAnswer(picked), QUIZ_PICK_MS + QUIZ_CLOSE_MS);
    return () => { clearTimeout(c); clearTimeout(t); };
  }, [picked, onAnswer]);
  return (
    <div className="game-dialog pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-[2px]">
      <div
        className="quiz-card w-full max-w-[540px]"
        data-closing={closing || undefined}
        style={accent ? ({ "--quiz-accent": accent } as CSSProperties) : undefined}
        role="dialog"
        aria-label={DECK_NAMES[deck]}
      >
        <header className="quiz-head">
          <div className="quiz-badge" aria-hidden>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="quiz-deck">{DECK_NAMES[deck]}</div>
            <div className="quiz-who">{name} menjawab</div>
          </div>
          <div className="quiz-chips">
            {chips.map((c, i) => (
              <span key={i} className={cn("quiz-chip", /suara/i.test(c) && "quiz-chip-reward")}>
                {c}
              </span>
            ))}
          </div>
        </header>
        <p className="quiz-q">{q.q}</p>
        <div className="quiz-grid" data-picked={picked !== null || undefined}>
          {q.options.map((o, i) => (
            <button
              key={i}
              type="button"
              className="quiz-opt"
              data-picked={picked === i || undefined}
              style={{ animationDelay: `${120 + i * 70}ms` }}
              disabled={picked !== null}
              onClick={() => {
                sfx.click();
                setPicked(i);
              }}
            >
              <span className="quiz-letter">{String.fromCharCode(65 + i)}</span>
              <span className="min-w-0">{o}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DebateDialog() {
  const awaiting = useGame((s) => s.awaiting);
  const answer = useGame((s) => s.answer);
  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState(60);
  const key = awaiting?.kind === "debate" ? `${awaiting.player}:${awaiting.title}` : "";
  useEffect(() => {
    setText("");
    setRemaining(awaiting?.kind === "debate" ? awaiting.seconds : 60);
  }, [key]);
  useEffect(() => {
    if (!key) return;
    const timer = setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [key]);
  if (awaiting?.kind !== "debate") return null;
  return (
    <div className="game-dialog pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4">
      <div className="paper-card card-flip-in max-h-[85dvh] w-full max-w-lg space-y-3 overflow-y-auto p-5">
        <h2 className="font-display text-xl">{awaiting.title}</h2>
        <p className="text-sm whitespace-pre-line">{awaiting.text}</p>
        <p className="font-display">{remaining} detik</p>
        <textarea
          aria-label="Argumen debat"
          className="min-h-24 w-full rounded border border-border bg-background p-3 text-foreground"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button disabled={!text.trim()} onClick={() => answer(text)}>
          Kirim tanggapan
        </Button>
      </div>
    </div>
  );
}

function GameOver() {
  const online = useGame((s) => s.online);
  const mySeat = useGame((s) => s.mySeat);
  const game = useGame((s) => s.game);
  if (!game.over) return null;
  const order = ranking(game);
  const youWon = order[0] === mySeat;
  return (
    <div className="game-dialog pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4">
      <div className="paper-card animate-pop-in w-full max-w-sm p-6 text-center">
        <Trophy className="mx-auto h-12 w-12 text-gold-deep" />
        <h2 className="mt-2 font-display text-4xl">
          {youWon ? "Kamu Pemenang 100 SUARA!" : `${game.players[order[0]!]!.name} menang`}
        </h2>
        <ol className="mt-4 space-y-2 text-left">
          {order.map((pi, r) => (
            <li
              key={pi}
              className="flex items-center gap-3 rounded-lg bg-paper-foreground/5 px-3 py-2"
            >
              <span className="w-8 font-display">{RANK_LABEL[r]!}</span>
              <span className={cn("h-3 w-3 rounded-full", PLAYER_BG[pi]!)} />
              <span className="flex-1">
                <b>{game.players[pi]!.name}</b>
                <small className="block text-muted-foreground">
                  Tangan {game.players[pi]!.cash} + petak {pledgedVotes(game, pi)}
                </small>
              </span>
              <span className="font-display">
                {game.players[pi]!.bankrupt ? "Gugur" : fmt(validVotes(game, pi))}
              </span>
            </li>
          ))}
        </ol>
        {!online && <button className="btn-gold mt-5 w-full py-3 text-xl" onClick={() => useGame.getState().openSetup()}>
          Main lagi
        </button>}
        <Link to="/" className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 font-semibold hover:bg-muted"><Home className="h-4 w-4" /> Kembali ke Beranda</Link>
      </div>
    </div>
  );
}

const LEVELS: { id: BotLevel; label: string; hint: string }[] = [
  { id: "mudah", label: "Mudah", hint: "Bot sering salah kuis" },
  { id: "sedang", label: "Sedang", hint: "Lawan seimbang" },
  { id: "sulit", label: "Sulit", hint: "Bot jarang salah" },
];
const STYLES: { id: BotStyle; label: string }[] = [
  { id: "hemat", label: "Hemat" },
  { id: "seimbang", label: "Seimbang" },
  { id: "agresif", label: "Agresif" },
];

/** Offline setup: difficulty, number of bot opponents and each bot's play style. */
function BotSetupDialog() {
  const open = useGame((s) => s.setupOpen);
  const saved = useGame((s) => s.botSetup);
  const [cfg, setCfg] = useState<BotSetup>(saved);
  useEffect(() => { if (open) setCfg(saved); }, [open, saved]);
  if (!open) return null;
  const running = useGame.getState().game.round > 1 || useGame.getState().game.openingShown;
  const chip = (on: boolean) => cn("setup-chip", on && "setup-chip-on");
  return (
    <div className="game-dialog pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
      <div className="paper-card card-flip-in max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto p-5" role="dialog" aria-label="Pengaturan bot">
        <div className="text-center">
          <div className="font-display text-2xl">Atur Lawan Bot</div>
          <p className="text-xs text-muted-foreground">Pilih tingkat kesulitan, jumlah lawan, dan gaya main tiap bot.</p>
        </div>
        <AvatarPicker />
        <section className="space-y-1.5">
          <div className="setup-label">Tingkat kesulitan</div>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" className={chip(cfg.level === l.id)} onClick={() => { sfx.click(); setCfg({ ...cfg, level: l.id }); }}>
                <b>{l.label}</b><small>{l.hint}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="space-y-1.5">
          <div className="setup-label">Jumlah lawan</div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" className={chip(cfg.opponents === n)} onClick={() => { sfx.click(); setCfg({ ...cfg, opponents: n }); }}>
                <b>{n}</b><small>bot</small>
              </button>
            ))}
          </div>
        </section>
        <section className="space-y-1.5">
          <div className="setup-label">Gaya main</div>
          {Array.from({ length: cfg.opponents }, (_, k) => (
            <div key={k} className="flex items-center gap-2">
              <img src={AVATARS[k + 1]} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
              <span className="w-12 shrink-0 font-display text-sm">{PLAYER_NAMES[k + 1]}</span>
              <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
                {STYLES.map((st) => (
                  <button key={st.id} type="button" className={cn(chip(cfg.styles[k] === st.id), "py-1")} onClick={() => {
                    sfx.click();
                    const styles = [...cfg.styles];
                    styles[k] = st.id;
                    setCfg({ ...cfg, styles });
                  }}>
                    <small className="!text-[11px] !font-bold">{st.label}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Hemat menyimpan suara, Agresif sering mengklaim wilayah.</p>
        </section>
        <div className="flex gap-2">
          {running ? (
            <Button variant="secondary" className="btn-soft h-auto flex-1 py-2.5" onClick={() => useGame.setState({ setupOpen: false, paused: false })}>
              Batal
            </Button>
          ) : (
            <Button asChild variant="secondary" className="btn-soft h-auto flex-1 py-2.5">
              <Link to="/">Batal</Link>
            </Button>
          )}
          <button className="btn-gold flex-[2] py-2.5 text-lg" onClick={() => { sfx.click(); useGame.getState().newGame(cfg); }}>
            {running ? "Mulai Ulang" : "Mulai Main"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AvatarPicker() {
  const avatar = useGame((s) => s.avatar);
  return (
    <section className="space-y-1.5">
      <div className="setup-label">Avatar kamu</div>
      <div className="grid grid-cols-10 gap-1.5">
        {AVATAR_CHOICES.map((src, i) => (
          <button key={i} type="button" aria-label={`Avatar ${i + 1}`} aria-pressed={avatar === i}
            onClick={() => { sfx.click(); useGame.getState().setAvatar(i); }}
            className={cn("aspect-square overflow-hidden rounded-full border-2 transition-transform hover:scale-110", avatar === i ? "border-gold scale-110 shadow-lg" : "border-transparent opacity-70")}>
            <img src={src} alt="" width={40} height={40} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}
