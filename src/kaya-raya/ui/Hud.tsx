import { useEffect, useRef } from "react";
import { Anchor, Coins, Gauge, Plane, RotateCcw, Shield, Trophy, Volume2, VolumeX } from "lucide-react";
import avKamu from "@/assets/avatars/kamu.jpg";
import avBudi from "@/assets/avatars/budi.jpg";
import avSari from "@/assets/avatars/sari.jpg";
import avJoko from "@/assets/avatars/joko.jpg";
import { GROUP_COLORS, LEVEL_NAMES, TILES } from "../sim/board";
import { fmt } from "../sim/format";
import { ranking, totalAssets, tollAtLevel } from "../sim/state";
import { useGame } from "../store";
import { sfx } from "../audio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SkipForward } from "lucide-react";
import { useCinematic, milestone } from "../scene/cinematic";
import { BoardEventStatus } from "./BoardEventStatus";

const PLAYER_BG = ["bg-player-1", "bg-player-2", "bg-player-3", "bg-player-4"];
const PLAYER_TEXT = ["text-player-1", "text-player-2", "text-player-3", "text-player-4"];
const CORNERS = [
  "bottom-3 left-3 sm:bottom-4 sm:left-4 short:bottom-2 short:left-2",
  "top-3 left-3 sm:top-4 sm:left-4 short:top-2 short:left-2",
  "top-3 right-3 sm:top-4 sm:right-4 short:top-2 short:right-2",
  "bottom-3 right-3 sm:bottom-4 sm:right-4 short:bottom-2 short:right-2",
];
const RANK_LABEL = ["1st", "2nd", "3rd", "4th"];
const AVATARS = [avKamu, avBudi, avSari, avJoko];
const RANK_STYLE = ["bg-gold text-primary-foreground", "bg-paper text-paper-foreground", "bg-gold-deep text-paper", "bg-secondary text-secondary-foreground"];

export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 select-none font-sans">
      {[0, 1, 2, 3].map((i) => (
        <PlayerPanel key={i} index={i} />
      ))}
      <TopCenter />
      <Controls />
      <BottomCenter />
      <BuyDialog />
      <PickPrompt />
      <BannerFx />
      <GameOver />
      <CinematicCaption />
    </div>
  );
}

function PlayerPanel({ index }: { index: number }) {
  const game = useGame((s) => s.game);
  const p = game.players[index]!;
  const rank = ranking(game).indexOf(index);
  const isTurn = game.turn === index && !game.over;
  const right = index === 2 || index === 3;

  return (
    <div
      className={cn(
        "card-frame absolute flex w-[156px] items-center gap-2 p-1.5 transition-transform duration-300 sm:w-[250px] sm:gap-3 sm:p-2.5 short:w-[168px] short:gap-1.5 short:p-1",
        CORNERS[index]!,
        right && "flex-row-reverse text-right",
        isTurn && "animate-turn-glow scale-[1.06] short:scale-100",
        p.bankrupt && "opacity-45 grayscale",
      )}
    >
      {isTurn && (
        <span
          className={cn(
            "absolute -top-3 rounded-full bg-gold px-2.5 py-0.5 font-display text-[10px] tracking-widest text-primary-foreground shadow-md sm:text-xs",
            right ? "right-4" : "left-4",
          )}
        >
          {p.isBot ? "GILIRAN" : "GILIRANMU"}
        </span>
      )}
      <div className="relative shrink-0">
        <div className="ring-frame">
          <img
            src={AVATARS[index]!}
            alt={p.name}
            width={256}
            height={256}
            className={cn("h-11 w-11 rounded-full object-cover sm:h-16 sm:w-16 short:h-9 short:w-9", PLAYER_BG[index]!)}
          />
        </div>
        <span
          className={cn(
            "absolute -bottom-1 rounded-full border border-gold px-1.5 font-display text-[10px] leading-4 shadow sm:text-xs",
            RANK_STYLE[rank]!,
            right ? "-left-1.5" : "-right-1.5",
          )}
        >
          {RANK_LABEL[rank]!}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-center gap-1", right && "flex-row-reverse")}>
          <span className={cn("h-2 w-2 shrink-0 rounded-full", PLAYER_BG[index]!)} />
          <span className="truncate font-display text-sm text-foreground sm:text-lg short:text-sm">{p.name}</span>
          {p.island > 0 && <Anchor className="h-3.5 w-3.5 text-accent" aria-label="Terdampar" />}
          {p.shield && <Shield className="h-3.5 w-3.5 text-good" aria-label="Kartu Malaikat" />}
          {p.travel && <Plane className="h-3.5 w-3.5 text-accent" aria-label="Siap terbang" />}
        </div>
        {p.bankrupt ? (
          <div className="font-display text-bad">BANGKRUT</div>
        ) : (
          <>
            <div className={cn("flex items-center gap-1", right && "flex-row-reverse")}>
              <Coins className="h-3.5 w-3.5 shrink-0 text-gold sm:h-4 sm:w-4" />
              <span className="text-gold-gradient font-display text-sm leading-tight sm:text-xl short:text-base">{fmt(p.cash)}</span>
            </div>
            <div className={cn("flex items-baseline justify-between gap-1 text-[10px] sm:text-xs", right && "flex-row-reverse")}>
              <span className="uppercase tracking-wider text-muted-foreground">Aset</span>
              <span className={cn("font-display sm:text-sm", PLAYER_TEXT[index]!)}>{fmt(totalAssets(game, index))}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TopCenter() {
  const round = useGame((s) => s.game.round);
  const max = useGame((s) => s.game.maxRounds);
  const notice = useGame((s) => s.notice);
  return (
    <div className="absolute left-1/2 top-24 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2 sm:top-4 short:top-2 short:w-[min(44vw,360px)] short:gap-1 short:origin-top short:scale-90">
      <div className="game-panel px-4 py-1 font-display text-sm text-foreground sm:text-base">
        Putaran <span className="text-gold">{round}</span> / {max}
      </div>
      <BoardEventStatus />
      {notice && (
        <div
          key={notice.id}
          className={cn(
            "animate-pop-in rounded-full px-4 py-2 text-center font-display text-sm text-outline sm:text-lg",
            notice.tone === "good" && "bg-good/90 text-primary-foreground",
            notice.tone === "bad" && "bg-bad/90 text-foreground",
            notice.tone === "info" && "card-frame text-foreground",
          )}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}

function Controls() {
  const fast = useGame((s) => s.fast);
  const muted = useGame((s) => s.muted);
  const toggleFast = useGame((s) => s.toggleFast);
  const toggleMute = useGame((s) => s.toggleMute);
  const newGame = useGame((s) => s.newGame);
  const btn = "btn-soft pointer-events-auto flex h-10 w-10 items-center justify-center";
  return (
    <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 sm:right-4 short:right-2 short:gap-1.5">
      <button className={cn(btn, fast && "bg-gold text-primary-foreground")} onClick={toggleFast} aria-label="Mode cepat" title="Mode cepat">
        <Gauge className="h-5 w-5" />
      </button>
      <button className={btn} onClick={toggleMute} aria-label={muted ? "Nyalakan suara" : "Matikan suara"} title="Suara">
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
      <button
        className={btn}
        onClick={() => confirm("Mulai permainan baru?") && newGame()}
        aria-label="Main baru"
        title="Main baru"
      >
        <RotateCcw className="h-5 w-5" />
      </button>
    </div>
  );
}

function BottomCenter() {
  const cinematic = useCinematic((s) => s.event);
  const awaiting = useGame((s) => s.awaiting);
  const turnName = useGame((s) => s.game.players[s.game.turn]!.name);
  const isBotTurn = useGame((s) => s.game.players[s.game.turn]!.isBot);
  const over = useGame((s) => s.game.over);
  if (over || cinematic) return null;
  return (
    <div className="absolute left-1/2 top-[57%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap short:top-auto short:bottom-12 short:translate-y-0">
      {awaiting?.kind === "roll" ? (
        <RollButton />
      ) : (
        isBotTurn && (
          <div className="game-panel px-4 py-2 font-display text-sm text-muted-foreground sm:text-base">
            Giliran {turnName}…
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

function RollButton() {
  const throwDice = useGame((s) => s.throwDice);
  const fill = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const st = useRef({ active: false, start: 0, power: 0, raf: 0 });
  const beginRef = useRef<() => void>(() => {});

  useEffect(() => {
    const s = st.current;
    const tick = () => {
      const t = (performance.now() - s.start) / 1000 / GAUGE_PERIOD;
      const ph = t % 2;
      s.power = ph < 1 ? ph : 2 - ph;
      if (fill.current) fill.current.style.width = `${Math.round(s.power * 100)}%`;
      s.raf = requestAnimationFrame(tick);
    };
    const begin = () => {
      if (s.active) return;
      s.active = true;
      s.start = performance.now();
      if (label.current) label.current.textContent = "LEPAS!";
      sfx.shakeStart();
      tick();
    };
    const release = () => {
      if (!s.active) return;
      s.active = false;
      cancelAnimationFrame(s.raf);
      const held = performance.now() - s.start;
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
      <div className="card-frame w-56 p-1.5 sm:w-72 short:w-44 short:p-1">
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
        className="btn-gold relative touch-none select-none overflow-hidden px-8 py-3 text-xl sm:px-12 sm:py-4 sm:text-3xl short:px-7 short:py-2 short:text-lg"
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
    <div key={banner.id} className="absolute inset-0 flex items-center justify-center overflow-hidden">
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
                className={cn("h-12 w-12 rounded-full object-cover sm:h-20 sm:w-20", PLAYER_BG[banner.player]!)}
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
            <div className="mt-1 animate-pop-in text-sm font-bold text-foreground sm:text-lg">{banner.text}</div>
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
  return <div className="absolute inset-x-0 bottom-[19%] flex flex-col items-center gap-2 px-4 sm:bottom-[8%]" data-cinematic={event.id}>
    <div className="max-w-full border-y border-gold bg-background/90 px-5 py-2 text-center">
      <div className="font-display text-2xl text-gold sm:text-4xl">{event.title}</div>
      <div className="max-w-[480px] text-sm text-foreground">{event.text}</div>
    </div>
    <Button variant="secondary" size="sm" onClick={skip} className="pointer-events-auto"><SkipForward />Lewati</Button>
  </div>;
}

function BuyDialog() {
  const awaiting = useGame((s) => s.awaiting);
  const game = useGame((s) => s.game);
  const answer = useGame((s) => s.answer);
  if (awaiting?.kind !== "buy") return null;
  const tile = TILES[awaiting.tile]!;
  const level = game.levels[awaiting.tile]!;
  const cash = game.players[awaiting.player]!.cash;
  const title =
    awaiting.mode === "buy" ? "Beli kota ini?" : awaiting.mode === "upgrade" ? "Bangun lagi?" : "Ambil alih kota?";

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-background/40 p-4">
      <div className="paper-card animate-pop-in w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 text-center" style={{ backgroundColor: GROUP_COLORS[tile.group]! }}>
          <div className="text-xs font-extrabold uppercase tracking-widest text-paper/90">{title}</div>
          <div className="font-display text-3xl text-paper text-outline">{tile.name}</div>
        </div>
        <div className="space-y-3 p-5">
          <BoardEventStatus tile={awaiting.tile} compact />
          <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
            {LEVEL_NAMES.map((n, l) => (
              <div
                key={n}
                className={cn("rounded-md bg-paper-foreground/5 px-1 py-1.5", l <= level && "bg-gold/40")}
              >
                <div className="font-bold">{n}</div>
                <div className="font-display text-sm">{fmt(tollAtLevel(game, awaiting.tile, l))}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs opacity-70">Sewa yang dibayar lawan per level · Uangmu {fmt(cash)}</p>
          <div className="flex flex-col gap-2">
            {awaiting.options
              .map((o, i) => ({ o, i }))
              .reverse()
              .map(({ o, i }) => (
                <button
                  key={i}
                  className="btn-gold flex items-center justify-between px-5 py-2.5 text-lg"
                  onClick={() => {
                    sfx.click();
                    answer(i);
                  }}
                >
                  <span>{awaiting.mode === "takeover" ? "Ambil alih" : `Sampai ${o.label}`}</span>
                  <span>{fmt(o.cost)}</span>
                </button>
              ))}
            <button className="btn-soft px-5 py-2 text-base" onClick={() => answer(-1)}>
              Lewati
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PickPrompt() {
  const awaiting = useGame((s) => s.awaiting);
  const answer = useGame((s) => s.answer);
  if (awaiting?.kind !== "pick") return null;
  const festival = awaiting.purpose === "festival";
  return (
    <div className="absolute left-1/2 top-[62%] flex w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
      <div className="game-panel animate-pop-in px-5 py-3 text-center font-display text-foreground">
        {festival ? "Pilih kotamu untuk Piala Dunia (sewa x2)" : "Klik petak tujuan terbangmu di papan"}
      </div>
      {festival && (
        <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
          {awaiting.tiles.map((t) => (
            <button key={t} className="btn-gold px-4 py-1.5 text-sm" onClick={() => answer(t)}>
              {TILES[t]!.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GameOver() {
  const game = useGame((s) => s.game);
  const newGame = useGame((s) => s.newGame);
  if (!game.over) return null;
  const order = ranking(game);
  const youWon = order[0]! === 0;
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-background/60 p-4">
      <div className="paper-card animate-pop-in w-full max-w-sm p-6 text-center">
        <Trophy className="mx-auto h-12 w-12 text-gold-deep" />
        <h2 className="mt-2 font-display text-4xl">{youWon ? "Kamu Kaya Raya!" : `${game.players[order[0]!]!.name} menang`}</h2>
        <ol className="mt-4 space-y-2 text-left">
          {order.map((pi, r) => (
            <li key={pi} className="flex items-center gap-3 rounded-lg bg-paper-foreground/5 px-3 py-2">
              <span className="w-8 font-display">{RANK_LABEL[r]!}</span>
              <span className={cn("h-3 w-3 rounded-full", PLAYER_BG[pi]!)} />
              <span className="flex-1 font-bold">{game.players[pi]!.name}</span>
              <span className="font-display">
                {game.players[pi]!.bankrupt ? "Bangkrut" : fmt(totalAssets(game, pi))}
              </span>
            </li>
          ))}
        </ol>
        <button className="btn-gold mt-5 w-full py-3 text-xl" onClick={newGame}>
          Main lagi
        </button>
      </div>
    </div>
  );
}
