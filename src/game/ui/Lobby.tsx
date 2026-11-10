import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight, Bot, Briefcase, Check, GraduationCap, HeartHandshake, Home, KeyRound, Landmark, Leaf, LogIn,
  Play, Plus, ShieldCheck, Smartphone, User, Users, Volume2, VolumeX, Wifi, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AREAS } from "../sim/board";
import type { SeatSetup } from "../sim/state";
import { DEFAULT_SEATS, useGame } from "../store";
import { sfx } from "../audio";
import { roomOperation } from "../online/rooms.functions";
import { AVATAR_LIST, DEFAULT_SEAT_AVATARS, PICKER_AVATARS, avatarSrc } from "./avatars";

export type LobbyMode = "bersama" | "bot";

const PLAYER_BG = ["bg-player-1", "bg-player-2", "bg-player-3", "bg-player-4", "bg-player-5"];
const AREA_ICON: Record<string, typeof Leaf> = {
  layanan: Landmark,
  inklusivitas: HeartHandshake,
  pendidikan: GraduationCap,
  lingkungan: Leaf,
  ekonomi: Briefcase,
};
const BOT_NAMES = ["Bot Harjo", "Bot Laras", "Bot Siti", "Bot Dimas", "Bot Maya"];
const humanName = (seat: number) => (seat === 0 ? "Kamu" : `Pemain ${seat + 1}`);
const isDefaultName = (name: string, seat: number) =>
  !name.trim() || name === humanName(seat) || name === BOT_NAMES[seat] || name === DEFAULT_SEATS[seat]?.name;

type Formation = { id: string; label: string; humans: number; icon: typeof Bot };
const FORMATIONS: Formation[] = [
  { id: "sim", label: "Simulasi 5 Bot", humans: 0, icon: Bot },
  { id: "1v4", label: "1 Manusia + 4 Bot", humans: 1, icon: User },
  { id: "2v3", label: "2 Manusia + 3 Bot", humans: 2, icon: Users },
  { id: "5h", label: "5 Manusia bergantian", humans: 5, icon: Users },
];
/** Same-device play: at least two people pass the device around. */
const LOCAL_FORMATIONS: Formation[] = [
  { id: "2v3", label: "2 Manusia + 3 Bot", humans: 2, icon: Users },
  { id: "3v2", label: "3 Manusia + 2 Bot", humans: 3, icon: Users },
  { id: "4v1", label: "4 Manusia + 1 Bot", humans: 4, icon: Users },
  { id: "5h", label: "5 Manusia bergantian", humans: 5, icon: Users },
];

/** Applies a quick formation: the first `humans` seats are people, the rest bots. */
export function applyFormation(seats: SeatSetup[], humans: number): SeatSetup[] {
  return seats.map((s, i) => {
    const bot = i >= humans;
    if (s.bot === bot) return s;
    return { bot, name: isDefaultName(s.name, i) ? (bot ? BOT_NAMES[i]! : humanName(i)) : s.name };
  });
}

const LOBBY_KEYS = { quick: "bot-lobby-v2", local: "local-lobby-v1" } as const;
type SeatVariant = keyof typeof LOBBY_KEYS;

/** Pre-game screen on /main: "Main Bersama" (online or one shared device) or "Quickmatch" against bots. */
export function Lobby() {
  const open = useGame((s) => s.setupOpen);
  const search = useSearch({ strict: false }) as { mode?: LobbyMode };
  const navigate = useNavigate();
  const [mode, setMode] = useState<LobbyMode>(search.mode ?? "bot");
  const [together, setTogether] = useState<"online" | "local">("online");
  useEffect(() => { if (search.mode) setMode(search.mode); }, [search.mode]);
  useEffect(() => {
    const raw = localStorage.getItem("my-avatar-v2");
    const v = raw === null ? NaN : Number(raw);
    if (v >= 0 && v < AVATAR_LIST.length) useGame.setState({ avatar: v });
  }, []);
  if (!open) return null;
  const pick = (m: LobbyMode) => {
    sfx.click();
    setMode(m);
    void navigate({ to: "/main", search: { mode: m }, replace: true });
  };
  return (
    <div className="lobby pointer-events-auto absolute inset-0 z-50 overflow-y-auto" role="dialog" aria-label="Pilih mode permainan">
      <LobbyTopBar mode={mode} onMode={pick} />
      <div className="mx-auto w-full max-w-5xl px-3 pb-8 pt-4 sm:px-5 sm:pt-10">
        {mode === "bot" ? <BotLobby key="quick" variant="quick" /> : <>
          <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cara main bersama">
            {([["online", Wifi, "Beda perangkat", "Online dengan kode ruang"], ["local", Smartphone, "Satu perangkat", "Bergantian di HP/laptop ini"]] as const).map(([id, Icon, label, hint]) => (
              <button key={id} type="button" role="radio" aria-checked={together === id} className={cn("lobby-option py-3", together === id && "is-on")}
                onClick={() => { sfx.click(); setTogether(id); }}>
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-left leading-tight"><b className="block">{label}</b><span className="text-xs opacity-80">{hint}</span></span>
              </button>
            ))}
          </div>
          {together === "online" ? <TogetherLobby /> : <BotLobby key="local" variant="local" />}
        </>}
      </div>
    </div>
  );
}

function LobbyTopBar({ mode, onMode }: { mode: LobbyMode; onMode: (m: LobbyMode) => void }) {
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  return (
    <div className="lobby-topbar">
      <Link to="/" className="lobby-icon-btn" aria-label="Beranda" title="Beranda"><Home className="h-5 w-5" /></Link>
      <div className="lobby-tabs" role="tablist" aria-label="Mode permainan">
        <button role="tab" aria-selected={mode === "bersama"} className={cn("lobby-tab", mode === "bersama" && "is-on")} onClick={() => onMode("bersama")}>
          <Users className="h-4 w-4" /> Main Bersama
        </button>
        <button role="tab" aria-selected={mode === "bot"} className={cn("lobby-tab", mode === "bot" && "is-on")} onClick={() => onMode("bot")}>
          <Bot className="h-4 w-4" /> Quickmatch
        </button>
      </div>
      <div className="flex gap-2">
        <Link to="/kunci-jawaban" className="lobby-icon-btn" aria-label="Kunci jawaban" title="Kunci jawaban"><KeyRound className="h-5 w-5" /></Link>
        <button className="lobby-icon-btn" onClick={toggleMute} aria-label={muted ? "Nyalakan suara" : "Matikan suara"} title="Suara">
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

function LobbyCard({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <section className="lobby-card card-flip-in">
      <header className="lobby-card-head">
        <span className="lobby-badge">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-tight sm:text-3xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function AvatarButton({ index, seat, onClick, size = "md" }: { index: number; seat: number; onClick: () => void; size?: "md" | "lg" }) {
  return (
    <button type="button" onClick={onClick} className={cn("lobby-avatar", PLAYER_BG[seat], size === "lg" && "is-lg")} aria-label="Ganti avatar">
      <img src={avatarSrc(index, seat)} alt="" width={96} height={96} />
      <span className="lobby-avatar-pill">Ganti</span>
    </button>
  );
}

function AvatarPicker({ value, onPick, onClose }: { value: number; onPick: (i: number) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="lobby-card w-full max-w-md" role="dialog" aria-label="Pilih avatar" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl">Pilih avatar</h3>
          <button className="lobby-icon-btn h-9 w-9" onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {PICKER_AVATARS.map((i) => { const src = AVATAR_LIST[i]!; return (
            <button key={i} type="button" aria-label={`Avatar ${i + 1}`} aria-pressed={value === i}
              onClick={() => { sfx.click(); onPick(i); onClose(); }}
              className={cn("relative aspect-square overflow-hidden rounded-full border-2 bg-foreground transition-transform hover:scale-105", value === i ? "border-gold" : "border-transparent opacity-80")}>
              <img src={src} alt="" width={64} height={64} className="h-full w-full object-cover" />
              {value === i && <Check className="absolute right-0 top-0 h-4 w-4 rounded-full bg-gold p-0.5 text-primary-foreground" />}
            </button>
          ); })}
        </div>
      </div>
    </div>
  );
}

function loadLineup(variant: SeatVariant): { seats: SeatSetup[]; avatars: number[] } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LOBBY_KEYS[variant]) ?? "null") as { seats?: SeatSetup[]; avatars?: number[] } | null;
    if (raw?.seats?.length === 5 && raw.avatars?.length === 5) return { seats: raw.seats, avatars: raw.avatars };
  } catch { /* ignore */ }
  return null;
}

function BotLobby({ variant }: { variant: SeatVariant }) {
  const local = variant === "local";
  const formations = local ? LOCAL_FORMATIONS : FORMATIONS;
  const saved = useGame((s) => s.botSetup);
  const running = useGame((s) => s.game.round > 1 || s.game.openingShown);
  // /main renders client-only (ssr: false), so browser storage is safe to read on first render.
  const [stored] = useState(() => loadLineup(variant));
  const [seats, setSeats] = useState<SeatSetup[]>(stored?.seats ?? (local ? applyFormation(DEFAULT_SEATS, 2) : saved.seats ?? DEFAULT_SEATS));
  const [avatars, setAvatars] = useState<number[]>(() => {
    const mine = useGame.getState().avatar;
    return stored?.avatars ?? DEFAULT_SEAT_AVATARS.map((a, i) => (i === 0 && mine >= 0 ? mine : a));
  });
  const [picking, setPicking] = useState<number | null>(null);
  useEffect(() => {
    try { localStorage.setItem(LOBBY_KEYS[variant], JSON.stringify({ seats, avatars })); } catch { /* ignore */ }
  }, [seats, avatars, variant]);
  const humans = seats.filter((s) => !s.bot).length;
  const firstHumans = seats.every((s, i) => s.bot === i >= humans);
  const update = (i: number, patch: Partial<SeatSetup>) => setSeats(seats.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const toggle = (i: number, bot: boolean) => {
    sfx.click();
    const s = seats[i]!;
    if (s.bot === bot) return;
    update(i, { bot, name: isDefaultName(s.name, i) ? (bot ? BOT_NAMES[i]! : humanName(i)) : s.name });
  };
  const start = () => {
    sfx.click();
    const lineup = seats.map((s, i) => ({ ...s, name: s.name.trim() || (s.bot ? BOT_NAMES[i]! : humanName(i)) }));
    const st = useGame.getState();
    useGame.setState({ seatAvatars: avatars });
    st.newGame({ ...st.botSetup, seats: lineup });
  };
  return (
    <LobbyCard icon={local ? <Smartphone className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      title={local ? "Main Bersama · Satu Perangkat" : "Quickmatch"}
      text={local ? "Dua sampai lima orang bergantian di satu perangkat. Kursi yang tidak dipakai dimainkan Bot." : "Langsung main. Lima kursi, lima area: isi tiap kursi dengan pemain di perangkat ini atau Bot otomatis."}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <div>
            <div className="lobby-label">Formasi cepat</div>
            <div className="grid grid-cols-2 gap-2">
              {formations.map((f) => (
                <button key={f.id} type="button" className={cn("lobby-option", firstHumans && humans === f.humans && "is-on")}
                  onClick={() => { sfx.click(); setSeats(applyFormation(seats, f.humans)); }}>
                  <f.icon className="h-4 w-4 shrink-0" /> <span>{f.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button className="btn-gold flex w-full items-center justify-center gap-2 py-3 text-xl disabled:opacity-50" disabled={local && humans < 2} onClick={start}>
            <Play className="h-5 w-5" /> {running ? "Mulai Ulang" : "Mulai Permainan"}
          </button>
          {running && (
            <button className="w-full rounded-xl border border-border py-2.5 font-semibold hover:bg-muted" onClick={() => useGame.setState({ setupOpen: false, paused: false })}>
              Lanjutkan permainan
            </button>
          )}
          <p className="text-sm text-muted-foreground">
            {local && humans < 2 ? "Pilih minimal 2 kursi Manusia untuk main bersama. " : humans > 1 ? "Pemain manusia bergantian di satu perangkat; tanda GILIRANMU menunjukkan siapa yang main. " : ""}Dadu dan jawaban bot diproses otomatis oleh sistem.
          </p>
        </div>
        <ol className="space-y-2">
          {seats.map((s, i) => (
            <li key={i} className="lobby-seat">
              <AvatarButton index={avatars[i]!} seat={i} onClick={() => setPicking(i)} />
              <div className="w-24 shrink-0 sm:w-28">
                <div className="truncate font-display text-sm sm:text-base">{AREAS[i]?.name}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Start {i + 1}</div>
              </div>
              <input aria-label={`Nama kursi ${i + 1}`} maxLength={24} value={s.name} onChange={(e) => update(i, { name: e.target.value })} className="lobby-input min-w-0 flex-1" />
              <div className="lobby-toggle" role="group" aria-label={`Kursi ${i + 1}`}>
                <button type="button" aria-label="Manusia" aria-pressed={!s.bot} className={cn(!s.bot && "is-on")} onClick={() => toggle(i, false)}><User className="h-4 w-4" /></button>
                <button type="button" aria-label="Bot" aria-pressed={s.bot} className={cn(s.bot && "is-on")} onClick={() => toggle(i, true)}><Bot className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {picking !== null && (
        <AvatarPicker value={avatars[picking]!} onClose={() => setPicking(null)}
          onPick={(v) => { setAvatars(avatars.map((a, k) => (k === picking ? v : a))); if (picking === 0) useGame.getState().setAvatar(v); }} />
      )}
    </LobbyCard>
  );
}

async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error("Belum bisa terhubung. Coba lagi sebentar.");
}

function TogetherLobby() {
  const navigate = useNavigate();
  const operation = useServerFn(roomOperation);
  const avatar = useGame((s) => s.avatar);
  const [name, setName] = useState("");
  const [area, setArea] = useState(0);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    setName(localStorage.getItem("player-name") ?? "");
    const a = Number(localStorage.getItem("player-area"));
    if (a >= 0 && a < 5) setArea(a);
  }, []);
  const go = async (op: "create" | "join") => {
    if (!name.trim()) { setError("Isi nama panggilan dulu."); return; }
    sfx.click();
    setBusy(true); setError("");
    try {
      await ensureSession();
      const id = await operation({ data: { operation: op, name: name.trim(), code: op === "join" ? code : undefined, seat: area, avatar: avatar >= 0 ? avatar : DEFAULT_SEAT_AVATARS[area]! } });
      if (id) await navigate({ to: "/ruang/$roomId", params: { roomId: id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coba lagi");
    } finally { setBusy(false); }
  };
  return (
    <LobbyCard icon={<Users className="h-6 w-6" />} title="Main Bersama" text="Satu ruang, lima suara untuk bangsa. Buat ruang baru atau gabung dengan kode undangan.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div>
            <div className="lobby-step"><b>01</b> Avatar &amp; nama panggilan</div>
            <div className="flex items-center gap-3">
              <AvatarButton index={avatar} seat={area} onClick={() => setPicking(true)} />
              <input aria-label="Nama pemain" placeholder="Nama pemain" maxLength={24} value={name}
                onChange={(e) => { setName(e.target.value); localStorage.setItem("player-name", e.target.value); }}
                className="lobby-input min-w-0 flex-1" />
            </div>
          </div>
          <div>
            <div className="lobby-step"><b>02</b> Area asal</div>
            <div className="grid grid-cols-5 gap-2">
              {AREAS.map((a, i) => {
                const Icon = AREA_ICON[a.key] ?? Landmark;
                return (
                  <button key={a.key} type="button" aria-pressed={area === i} className={cn("lobby-area", area === i && "is-on")}
                    onClick={() => { sfx.click(); setArea(i); localStorage.setItem("player-area", String(i)); }}>
                    {area === i && <Check className="lobby-area-check" />}
                    <span className={cn("lobby-area-icon", PLAYER_BG[i])}><Icon className="h-4 w-4" /></span>
                    <span className="text-[11px] font-semibold leading-tight sm:text-xs">{a.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Jika area sudah dipakai di ruang tujuan, kamu mendapat area kosong berikutnya.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="lobby-box">
            <div className="lobby-label">Mulai ruang baru</div>
            <button className="lobby-create" disabled={busy} onClick={() => void go("create")}>
              <Plus className="h-5 w-5" /> <span className="flex-1 text-left">Buat Ruang</span> <ArrowRight className="h-5 w-5" />
            </button>
          </div>
          <div className="lobby-box">
            <div className="lobby-label">Punya kode undangan?</div>
            <div className="flex gap-2">
              <input aria-label="Kode undangan" placeholder="Kode undangan" autoCapitalize="characters" maxLength={8} value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                className="lobby-input min-w-0 flex-1 font-mono" />
              <button className="lobby-join" disabled={busy || code.length !== 8} onClick={() => void go("join")}>
                <LogIn className="h-4 w-4" /> Gabung
              </button>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <p className="flex gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" /> Nama panggilan saja; tanpa NIK, email, atau nomor telepon. Kursi kosong dimainkan bot.
          </p>
        </div>
      </div>
      {picking && <AvatarPicker value={avatar >= 0 ? avatar : DEFAULT_SEAT_AVATARS[area]!} onClose={() => setPicking(false)} onPick={(v) => useGame.getState().setAvatar(v)} />}
    </LobbyCard>
  );
}
