// Browser-safe shared rule definitions: types, constants and read-only helpers.
// The reducer (engine.ts) imports these; answer keys stay in engine/cards.
import { PENT_TOTAL, outerType, outerArea, safeGateOf, safeGateArea, type OuterType } from "./board-config";
export { OUTER_PER_AREA, OUTER_TOTAL, GATE_LEN, PENT_TOTAL, PENT_PER_AREA, OUTER_PATTERN, outerType, outerArea, outerDemokrasiSub, outerKejutanSub, isSafeGate, safeGateOf, safeGateArea, type OuterType, type DemokrasiSub, type KejutanSub } from "./board-config";
export const AREAS = [
  { name: "Pendidikan", short: "PDK", icon: "📘" },
  { name: "Lingkungan", short: "LGK", icon: "🌿" },
  { name: "Ekonomi", short: "EKO", icon: "💼" },
  { name: "Layanan Publik", short: "LYP", icon: "🏛️" },
  { name: "Inklusivitas", short: "INK", icon: "🤝" },
] as const;

/** Versi aturan: 2 = Panduan Permainan 100 SUARA (draf terbaru). */
export const RULESET = 2;
export const TOKENS_TOTAL = 100;
export const TOKENS_PER_AREA = 20;
/** Syarat masuk Gerbang Demokrasi: suara di tangan. */
export const QUALIFY_VOTES = 16;
/** Hadiah jawaban benar kartu Aspirasi dan Demokrasi. */
export const CORRECT_REWARD = 2;
/** Jaminan suara untuk mengklaim satu petak Pentagon. */
export const CLAIM_COST = 4;
export const MAX_CLAIMS = 5;
/** Penyerahan saat perebutan petak lawan gagal. */
export const CONTEST_PENALTY = 2;
/** Penyerahan penantang yang kalah duel di Gerbang Aman lawan. */
export const HOME_PENALTY = 5;
export const WIN_TARGET = 50;
export const WIN_TARGET_HIGH = 70;
/** Batas pengaman putaran tambahan agar permainan selalu berakhir (tidak diatur panduan). */
export const EXTRA_ROUNDS_CAP = 3;

export const STOCK = -1;
export const escrowLoc = (space: number) => 100 + space;

/** "done" = dua putaran Pentagon tuntas, menunggu; "out" = gugur. */
export type Phase = "outer" | "gate" | "pentagon" | "done" | "out";

export interface Token {
  id: number;
  origin: number;
  loc: number; // -1 stok, 0..4 tangan pemain, 100+s jaminan petak Pentagon
}

export interface Player {
  id: number;
  name: string;
  area: number;
  isBot: boolean;
  avatar?: number | undefined;
  phase: Phase;
  outerPos: number; // -1 = START
  gatePos: number; // 0 = belum masuk, 1..5
  pentRound: number; // 1, 2, lalu 3+ pada putaran tambahan
  pentSteps: number; // 0..20 langkah bersih dari Gerbang Aman asal
  areaTokens: boolean[];
  emergency: number; // Poin Kelayakan (bukan suara asli)
  skipTurns: number;
}

export type ForfeitOption =
  | { type: "votes"; n: number }
  | { type: "space"; space: number }
  | { type: "home"; area: number };

export type Pending =
  | { kind: "aspirasi"; cardId: string; area: number }
  | { kind: "cekfakta"; cardId: string; area: number }
  | { kind: "misi"; cardId: string; area: number }
  | { kind: "dilema"; cardId: string; area: number }
  | { kind: "refleksi"; cardId: string; area: number }
  | { kind: "forum"; cardId: string; area: number; stance: number | null; votes: Record<number, number> }
  | { kind: "kejutan"; cardId: string; area: number }
  | { kind: "putusan"; cardId: string; votes: Record<number, number> }
  | { kind: "claim"; space: number }
  | { kind: "duel"; cardId: string; opponent: number; space: number; home: boolean; answers: Record<number, number> }
  | { kind: "forfeit"; payer: number; receiver: number; space: number; reason: string; options: ForfeitOption[] };

export interface FinalState {
  scores: number[];
  finalists: number[];
  stage: "argue" | "vote" | "objective" | "done";
  caseId: string | null;
  votes: Record<number, number>;
  objective: { cardId: string; answers: Record<number, number>; round: number } | null;
  winners: number[];
  note: string;
}

export interface LogEntry {
  n: number;
  at?: number;
  text: string;
  tone: "info" | "gain" | "loss" | "system";
  who?: number | undefined;
}

export interface LastResult {
  title: string;
  lines: string[];
  tone: "gain" | "loss" | "info";
  cardId?: string;
  choice?: number | undefined;
  correct?: number | undefined;
}

export interface GameState {
  version: number;
  ruleset?: number;
  createdAt: number;
  seed: number;
  players: Player[];
  tokens: Token[];
  spaces: (number | null)[];
  /** Pemilik Gerbang Aman/Homebase per area (id pemain). */
  homeOwner: number[];
  /** Putaran lanjutan bila belum ada yang mencapai target suara. */
  extended: { target: number } | null;
  order: number[];
  turnIdx: number;
  turnCount: number;
  stage: "roll" | "pending" | "end" | "over";
  pending: Pending | null;
  lastDice: number | null;
  extraRollUsed: boolean;
  grantExtra: boolean;
  decks: Record<string, string[]>;
  log: LogEntry[];
  lastResult: LastResult | null;
  final: FinalState | null;
  seenActions: string[];
}

export type Action =
  | { type: "ROLL"; value?: number; id?: string }
  | { type: "ANSWER"; choice: number; id?: string }
  | { type: "ACK"; id?: string }
  | { type: "FORUM_STANCE"; choice: number; id?: string }
  | { type: "VOTE"; voter: number; choice: number; id?: string }
  | { type: "CLAIM"; accept: boolean; id?: string }
  | { type: "DUEL_ANSWER"; player: number; choice: number; id?: string }
  | { type: "FORFEIT"; player: number; option: number; id?: string }
  | { type: "END_TURN"; id?: string }
  | { type: "FDT_START_VOTE"; id?: string }
  | { type: "FDT_ANSWER"; player: number; choice: number; id?: string };

export interface PlayerConfig {
  name: string;
  isBot: boolean;
  avatar?: number | undefined;
}

// ---------- Ledger ----------
export const handCount = (s: GameState, pid: number) => s.tokens.filter((t) => t.loc === pid).length;
export const stockCount = (s: GameState, area: number) =>
  s.tokens.filter((t) => t.loc === STOCK && t.origin === area).length;
export const stockTotal = (s: GameState) => s.tokens.filter((t) => t.loc === STOCK).length;
export const escrowCount = (s: GameState, space: number) =>
  s.tokens.filter((t) => t.loc === escrowLoc(space)).length;
export const ownedSpaces = (s: GameState, pid: number) =>
  s.spaces.map((o, i) => (o === pid ? i : -1)).filter((i) => i >= 0);
export const escrowOwned = (s: GameState, pid: number) =>
  ownedSpaces(s, pid).reduce((sum, sp) => sum + escrowCount(s, sp), 0);
/** Suara sah = suara di tangan + suara jaminan pada petak yang masih dimiliki. */
export const legalVotes = (s: GameState, pid: number) => handCount(s, pid) + escrowOwned(s, pid);

/** Pemilik Gerbang Aman area `area` (default: pemain area itu). */
export const homeOwnerOf = (s: GameState, area: number) =>
  s.homeOwner?.[area] ?? s.players.find((p) => p.area === area)?.id ?? area;
export const homesOwned = (s: GameState, pid: number) =>
  [0, 1, 2, 3, 4].filter((a) => homeOwnerOf(s, a) === pid);

export const currentPlayer = (s: GameState) => s.players[s.order[s.turnIdx]!]!;
export const isAlive = (p: Player) => p.phase !== "out";

export const isEligibleForGate = (s: GameState, p: Player) =>
  p.phase === "outer" && handCount(s, p.id) + p.emergency >= QUALIFY_VOTES;
export const misiActive = (s: GameState, p: Player) =>
  p.phase === "outer" && stockTotal(s) === 0 && handCount(s, p.id) + p.emergency < QUALIFY_VOTES;
export const pentSpaceOf = (p: Player) => (safeGateOf(p.area) + p.pentSteps) % PENT_TOTAL;
export const canClaim = (s: GameState, p: Player) =>
  ownedSpaces(s, p.id).length < MAX_CLAIMS && handCount(s, p.id) >= CLAIM_COST;
/** Pemilih Putusan Rakyat: pemain lain yang belum gugur, searah urutan giliran. */
export const votersFor = (s: GameState, target: number) => {
  const start = s.order.indexOf(target);
  return [1, 2, 3, 4].map((k) => s.order[(start + k) % 5]).filter((id) => isAlive(s.players[id!]!));
};

const OUTER_NAME: Record<OuterType, string> = {
  A1: "Aspirasi Mudah",
  A2: "Aspirasi Sedang",
  A3: "Aspirasi Sulit",
  D: "Demokrasi",
  K: "Kejutan",
  E: "Petak Kosong",
};
export function describePosition(p: Player): string {
  if (p.phase === "outer")
    return p.outerPos < 0 ? "START" : `area ${AREAS[outerArea(p.outerPos)]!.name} (L${p.outerPos + 1} · ${OUTER_NAME[outerType(p.outerPos)!]})`;
  if (p.phase === "gate") return `Gerbang Demokrasi petak ${p.gatePos}`;
  if (p.phase === "pentagon")
    return p.pentSteps === 0 ? `Gerbang Aman ${AREAS[p.area]!.name} (putaran ${p.pentRound})` : `Pentagon P${pentSpaceOf(p) + 1} (putaran ${p.pentRound})`;
  if (p.phase === "out") return "gugur";
  return "Pusat Perhitungan";
}
export { safeGateArea as homeAreaOfSpace };

export const fdtVoters = (s: GameState) =>
  s.final ? s.order.filter((id) => !s.final?.finalists.includes(id) && isAlive(s.players[id!]!)) : [];

// ---------- Actor ----------
/** Siapa yang harus bertindak sekarang: id pemain, "host" (siapa pun), atau null. */
export function getActor(s: GameState): number | "host" | null {
  if (s.stage === "over") {
    const f = s.final;
    if (!f || f.stage === "done") return null;
    if (f.stage === "argue") return "host";
    if (f.stage === "vote") return fdtVoters(s).find((v) => f.votes[v] === undefined) ?? null;
    return f.finalists.find((id) => f.objective?.answers[id] === undefined) ?? null;
  }
  const cur = currentPlayer(s).id;
  const pend = s.pending;
  if (!pend) return cur;
  if (pend.kind === "forum") {
    if (pend.stance === null) return cur;
    return votersFor(s, cur).find((v) => pend.votes[v!] === undefined) ?? null;
  }
  if (pend.kind === "putusan") return votersFor(s, cur).find((v) => pend.votes[v!] === undefined) ?? null;
  if (pend.kind === "duel") return [cur, pend.opponent].find((id) => pend.answers[id] === undefined) ?? null;
  if (pend.kind === "forfeit") return pend.payer;
  return cur;
}

/** Konteks rahasia: pilihan pemain sebelumnya tidak boleh terlihat. */
export function isSecretContext(s: GameState): boolean {
  const k = s.pending?.kind;
  if (k === "putusan" || k === "duel" || (k === "forum" && s.pending && (s.pending as { stance: number | null }).stance !== null)) return true;
  return s.stage === "over" && (s.final?.stage === "vote" || s.final?.stage === "objective");
}

/** Teks satu pilihan penyerahan untuk tampilan. */
export function forfeitLabel(s: GameState, o: ForfeitOption): string {
  if (o.type === "votes") return `Serahkan ${o.n} suara di tangan`;
  if (o.type === "space") return `Serahkan petak P${o.space + 1} beserta ${escrowCount(s, o.space)} suara jaminan`;
  return `Serahkan Gerbang Aman ${AREAS[o.area]!.name} (tanpa suara)`;
}
