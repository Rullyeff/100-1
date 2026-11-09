import { cn } from "@/lib/utils";
import { currentPlayer, type GameState, type Player } from "@/site/view";
import { AREA_BG } from "./theme";
import a1 from "@/assets/avatars/avatar-1.webp";
import a2 from "@/assets/avatars/avatar-2.webp";
import a3 from "@/assets/avatars/avatar-3.webp";
import a4 from "@/assets/avatars/avatar-4.webp";
import a5 from "@/assets/avatars/avatar-5.webp";
import a6 from "@/assets/avatars/avatar-6.webp";
import a7 from "@/assets/avatars/avatar-7.webp";
import a8 from "@/assets/avatars/avatar-8.webp";
import a9 from "@/assets/avatars/avatar-9.webp";
import a10 from "@/assets/avatars/avatar-10.webp";
import a11 from "@/assets/avatars/avatar-11.webp";
import a12 from "@/assets/avatars/avatar-12.webp";
import a13 from "@/assets/avatars/avatar-13.webp";
import a14 from "@/assets/avatars/avatar-14.webp";
import a15 from "@/assets/avatars/avatar-15.webp";
import a16 from "@/assets/avatars/avatar-16.webp";
import a17 from "@/assets/avatars/avatar-17.webp";
import a18 from "@/assets/avatars/avatar-18.webp";

// Order is stable: saved games store the index. Length must equal AVATAR_COUNT in the engine.
export const AVATARS = [
  { src: a1, name: "Siti · Pelajar" },
  { src: a2, name: "Raka · Pelajar" },
  { src: a3, name: "Maya · Mahasiswa" },
  { src: a4, name: "Pak Harjo · Petani" },
  { src: a5, name: "Dimas · Pemuda" },
  { src: a6, name: "Bu Laras · Ibu Rumah Tangga" },
  { src: a7, name: "Dokter" },
  { src: a8, name: "Petani" },
  { src: a9, name: "Guru" },
  { src: a10, name: "Polisi" },
  { src: a11, name: "Perawat" },
  { src: a12, name: "Nelayan" },
  { src: a13, name: "Insinyur" },
  { src: a14, name: "Wartawan" },
  { src: a15, name: "Pedagang" },
  { src: a16, name: "Pemadam Kebakaran" },
  { src: a17, name: "Programmer" },
  { src: a18, name: "Tokoh Masyarakat" },
];
export const avatarOf = (p: Pick<Player, "avatar" | "area">) => AVATARS[p.avatar ?? p.area % AVATARS.length] ?? AVATARS[0];

/** Grid of every avatar; used by practice setup and the online room entry. */
export function AvatarGrid({ area, value, onPick }: { area: number; value: number; onPick: (k: number) => void }) {
  return (
    <div className="grid max-h-72 grid-cols-4 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-6" role="radiogroup" aria-label="Pilih avatar">
      {AVATARS.map((av, k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          title={av.name}
          onClick={() => onPick(k)}
          className={cn("flex flex-col items-center gap-1 rounded-xl border bg-card p-1.5 text-[10px] leading-tight transition hover:-translate-y-0.5 hover:shadow-card", value === k && "border-gold bg-gold/10 ring-2 ring-gold")}
        >
          <PlayerAvatar area={area} avatar={k} size={44} />
          <span className="line-clamp-1 text-center">{av.name.split(" · ").pop()}</span>
        </button>
      ))}
    </div>
  );
}

export type Mood = "idle" | "thinking" | "happy" | "sad";

/** Ekspresi avatar: berpikir saat membaca soal, senang saat jawaban benar. */
export function moodOf(state: GameState, playerId: number): Mood {
  if (state.stage === "over") return "idle";
  const cur = currentPlayer(state);
  const pend = state.pending as { cardId?: string; answers?: Record<number, number>; votes?: Record<number, number> } | null;
  if (state.stage === "pending" && pend?.cardId) {
    if (playerId === cur.id) return "thinking";
    if (pend.answers && playerId in pend.answers) return "thinking";
    if (pend.votes && !(playerId in pend.votes)) return "thinking";
  }
  if (state.stage === "end" && playerId === cur.id && state.lastResult) {
    if (state.lastResult.tone === "gain") return "happy";
    if (state.lastResult.tone === "loss") return "sad";
  }
  return "idle";
}

const LABEL: Record<Mood, string> = { idle: "", thinking: "sedang berpikir", happy: "senang", sad: "sedih" };

export function PlayerAvatar({
  area,
  avatar,
  mood = "idle",
  size = 40,
  dim,
  className,
}: {
  area: number;
  avatar?: number | undefined;
  mood?: Mood;
  size?: number;
  dim?: boolean;
  className?: string;
}) {
  const a = avatarOf({ avatar, area });
  return (
    <span
      role="img"
      aria-label={`Avatar ${a!.name}${LABEL[mood] ? `, ${LABEL[mood]}` : ""}`}
      className={cn("avatar relative inline-flex shrink-0", `avatar-${mood}`, className)}
      style={{ width: size, height: size }}
    >
      <span className={cn("avatar-ball absolute inset-0 overflow-hidden rounded-full", AREA_BG[area], dim && "grayscale")}>
        <img src={a!.src} alt="" width={size} height={size} loading="lazy" className="avatar-face absolute inset-x-0 bottom-0 size-full object-cover object-top" />
        <span className="avatar-gloss absolute inset-0 rounded-full" />
      </span>
      {mood === "thinking" && (
        <span aria-hidden className="avatar-bubble absolute -right-2 -top-3 flex items-center gap-0.5 rounded-full border bg-card px-1.5 py-1 text-foreground shadow">
          <span className="avatar-dot" />
          <span className="avatar-dot" />
          <span className="avatar-dot" />
        </span>
      )}
      {mood === "happy" && <span aria-hidden className="avatar-sparkle absolute -right-1.5 -top-2 text-sm">✨</span>}
      {mood === "sad" && <span aria-hidden className="absolute -right-1 -top-1 text-xs">💧</span>}
    </span>
  );
}
