// V4.0 rules. Generator requests are shared by the UI controller and rule tests.
import {
  AREAS,
  AREA_COUNT,
  GATE_LEN,
  GATE_REQUIREMENT,
  MAX_PLOTS,
  PENT_LEN,
  PLEDGE,
  RING_LEN,
  TILES,
  gateId,
  homeId,
  pentId,
  ringId,
  segmentOf,
} from "./board";
import { QUESTIONS, questionPool, type Deck } from "./quiz";
import { plotsOf, rand, rollDie, ranking, validVotes, type GameState, type Player } from "./state";
import officialCards from "./official-cards.json";
import { fmt } from "./format";
export type Tone = "info" | "good" | "bad";
export interface BuyOption {
  toLevel: number;
  cost: number;
  label: string;
}
export type Req =
  | { kind: "roll"; player: number }
  | { kind: "step"; player: number; tile: number; salary: boolean }
  | { kind: "jump"; player: number; tile: number }
  | {
      kind: "notice";
      text: string;
      tone: Tone;
      player?: number | undefined;
      ms?: number | undefined;
      banner?: string | undefined;
    }
  | { kind: "buy"; player: number; tile: number; mode: "claim"; options: BuyOption[] }
  | {
      kind: "quiz";
      player: number;
      deck: Deck;
      question: number;
      stake: string;
      tag?: string | undefined;
    }
  | {
      kind: "choose";
      player: number;
      title: string;
      text: string;
      options: string[];
      prefer: number;
    }
  | { kind: "debate"; player: number; title: string; text: string; seconds: number };
export type Turn = Generator<Req, void, unknown>;
const notice = (
  text: string,
  tone: Tone = "info",
  player?: number,
  ms?: number,
  banner?: string,
): Req => ({ kind: "notice", text, tone, player, ms, banner });
type OfficialCard = (typeof officialCards)[number];

/** Draw without replacement; reshuffle the used subdeck only when exhausted. */
function draw(s: GameState, key: string, pool: number[]): number {
  if (!pool.length) throw new Error(`Subdek kosong: ${key}`);
  if (!s.decks[key]?.length) {
    const pile = [...pool];
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s) * (i + 1));
      const a = pile[i] ?? 0;
      pile[i] = pile[j] ?? 0;
      pile[j] = a;
    }
    s.decks[key] = pile;
  }
  return s.decks[key]?.pop() ?? pool[0] ?? 0;
}
function card(s: GameState, prefix: string): OfficialCard {
  const pool = officialCards.flatMap((c, i) => (c.code.startsWith(prefix) ? [i] : []));
  const c = officialCards[draw(s, prefix, pool)];
  if (!c) throw new Error("Kartu tidak tersedia");
  return c;
}
export function* askQuiz(
  s: GameState,
  pi: number,
  deck: Deck,
  stake: string,
  filter: { area?: string | undefined; tag?: string | undefined } = {},
): Generator<Req, boolean, unknown> {
  const cleanFilter = {
    ...(filter.area ? { area: filter.area } : {}),
    ...(filter.tag ? { tag: filter.tag } : {}),
  };
  const question = draw(
    s,
    `${deck}:${filter.area ?? ""}:${filter.tag ?? ""}`,
    questionPool(deck, cleanFilter),
  );
  const q = QUESTIONS[deck][question];
  if (!q) return false;
  const pick = yield { kind: "quiz", player: pi, deck, question, stake, tag: filter.tag };
  const ok = pick === q.answer;
  yield notice(
    ok ? `${s.players[pi]?.name} menjawab benar!` : `Jawaban: ${q.options[q.answer]}`,
    ok ? "good" : "bad",
    pi,
  );
  return ok;
}
function* officialQuiz(
  s: GameState,
  pi: number,
  c: OfficialCard,
  stake: string,
): Generator<Req, boolean, unknown> {
  const pick = yield {
    kind: "choose",
    player: pi,
    title: c.title,
    text: `${c.text}\n${stake}`,
    options: c.options,
    prefer: c.answer ?? 0,
  };
  return pick === c.answer;
}
function takeOrigins(p: Player, n: number): number[] {
  const amount = Math.min(n, p.cash);
  let left = amount;
  const taken = p.votes.map((v, a) => {
    const k = Math.min(v, left);
    p.votes[a] = v - k;
    left -= k;
    return k;
  });
  if (left > 0) taken[p.id] = (taken[p.id] ?? 0) + left; // Allows explicitly configured dev/test states.
  p.cash -= amount;
  return taken;
}
function receive(p: Player, origins: number[]) {
  origins.forEach((n, a) => {
    p.votes[a] = (p.votes[a] ?? 0) + n;
    p.cash += n;
  });
  if (p.cash > 0) p.hadVotes = true;
}
export function* give(s: GameState, pi: number, n: number, reason: string, area = pi): Turn {
  const p = s.players[pi];
  if (!p) return;
  const amount = Math.min(n, s.stock[area] ?? 0);
  s.stock[area] = (s.stock[area] ?? 0) - amount;
  const origins = new Array(AREA_COUNT).fill(0);
  origins[area] = amount;
  receive(p, origins);
  yield notice(`${reason}: +${fmt(amount)} · ${AREAS[area]?.name}`, amount ? "good" : "info", pi);
}
export function* giveBack(s: GameState, pi: number, n: number, reason: string): Turn {
  const p = s.players[pi];
  if (!p) return;
  const origins = takeOrigins(p, n);
  origins.forEach((v, a) => {
    s.stock[a] = (s.stock[a] ?? 0) + v;
  });
  yield notice(
    `${reason}: kembalikan ${fmt(origins.reduce((a, b) => a + b, 0))} ke stok asal`,
    "bad",
    pi,
  );
}
export function transfer(s: GameState, from: number, to: number, n: number): number {
  const a = s.players[from],
    b = s.players[to];
  if (!a || !b) return 0;
  const origins = takeOrigins(a, n);
  receive(b, origins);
  return origins.reduce((x, y) => x + y, 0);
}
function unplant(s: GameState, tile: number, pi: number) {
  const p = s.players[pi];
  if (!p) return;
  const origins = [...(s.plotVotes[tile] ?? [])];
  const actual = origins.reduce((a, b) => a + b, 0),
    pledge = s.invested[tile] ?? 0;
  if (actual < pledge)
    origins[TILES[tile]?.area ?? pi] = (origins[TILES[tile]?.area ?? pi] ?? 0) + pledge - actual;
  receive(p, origins);
  s.plotVotes[tile] = new Array(AREA_COUNT).fill(0);
  s.owners[tile] = -1;
  s.levels[tile] = -1;
  s.invested[tile] = 0;
}
function nextOuter(pos: number, dir: number): number {
  const seg = segmentOf(pos);
  if (seg.seg !== "ring") return pos;
  if (dir > 0)
    return seg.r >= 15 ? ringId((seg.area + 1) % AREA_COUNT, 1) : ringId(seg.area, seg.r + 1);
  return seg.r <= 1
    ? ringId((seg.area + AREA_COUNT - 1) % AREA_COUNT, 15)
    : ringId(seg.area, seg.r - 1);
}
function* ringMove(s: GameState, pi: number, n: number): Turn {
  const p = s.players[pi];
  if (!p) return;
  for (let i = 0; i < Math.abs(n); i++) {
    p.pos = nextOuter(p.pos, Math.sign(n));
    yield { kind: "step", player: pi, tile: p.pos, salary: false };
  }
}
function* gateMove(s: GameState, pi: number, n: number): Turn {
  const p = s.players[pi];
  if (!p) return;
  const seg = segmentOf(p.pos);
  const g = seg.seg === "gate" ? seg.g : -1;
  const target = Math.max(-1, Math.min(GATE_LEN - 1, g + n));
  for (let i = g; i !== target;) {
    i += Math.sign(target - g);
    p.pos = i < 0 ? ringId(pi, 8) : gateId(pi, i);
    yield { kind: "step", player: pi, tile: p.pos, salary: false };
  }
}
function* retreat(s: GameState, pi: number, n: number): Turn {
  const p = s.players[pi];
  if (!p) return;
  const seg = segmentOf(p.pos);
  if (seg.seg !== "pent") return;
  // Progress can be derived for explicit dev/test positions.
  p.progress = Math.max(p.progress, (seg.p - pi * 4 + PENT_LEN) % PENT_LEN);
  for (let i = 0; i < n && p.progress > 0; i++) {
    p.progress--;
    p.pos = pentId(pi * 4 + p.progress);
    yield { kind: "step", player: pi, tile: p.pos, salary: false };
  }
}
export function* walk(s: GameState, pi: number, steps: number): Turn {
  const p = s.players[pi];
  if (!p || p.phase === "done") return;
  if (p.phase === "ring") {
    yield* ringMove(s, pi, steps);
    return;
  }
  if (p.phase === "gate") {
    yield* gateMove(s, pi, steps);
    return;
  }
  const seg = segmentOf(p.pos);
  if (seg.seg !== "pent") return;
  p.progress = Math.max(p.progress, (seg.p - pi * 4 + PENT_LEN) % PENT_LEN);
  for (let i = 0; i < steps && p.progress < PENT_LEN; i++) {
    p.progress++;
    p.pos = pentId(pi * 4 + p.progress);
    yield { kind: "step", player: pi, tile: p.pos, salary: false };
  }
  if (p.progress === PENT_LEN) {
    p.laps++;
    p.progress = 0;
    if (p.laps === 2) p.phase = "done";
    yield notice(
      p.phase === "done"
        ? `${p.name} menyelesaikan dua putaran`
        : `${p.name} menuntaskan Putaran 1`,
      "good",
      pi,
    );
  }
}
export function canEnterGate(s: GameState, pi: number): boolean {
  const p = s.players[pi];
  return (
    !!p &&
    p.areaTokens.every(Boolean) &&
    (p.cash >= GATE_REQUIREMENT ||
      (s.stock.every((v) => v === 0) && p.cash + p.eligibility >= GATE_REQUIREMENT))
  );
}
function* challenge(
  s: GameState,
  pi: number,
  area: number,
  deck: Deck,
  tag: string,
  reward: number,
): Turn {
  const p = s.players[pi];
  if (!p) return;
  let ok = yield* askQuiz(s, pi, deck, `${AREAS[area]?.name} · ${tag} · +${reward} suara`, {
    area: deck === "aspirasi" ? AREAS[area]?.key : undefined,
    tag,
  });
  if (!ok && p.retry && deck === "aspirasi") {
    p.retry = false;
    ok = yield* askQuiz(s, pi, deck, "Kesempatan ulang", { area: AREAS[area]?.key, tag });
  }
  if (ok) {
    p.areaTokens[area] = true;
    if (reward) yield* give(s, pi, reward, "Tantangan berhasil", area);
    yield notice(`Token Area ${AREAS[area]?.name} diperoleh`, "good", pi);
  }
}
export function resolveVote(votes: number[], lighter = 0): number {
  const a = votes.filter((v) => v === 0).length,
    b = votes.filter((v) => v === 1).length;
  return a === b ? lighter : a > b ? 0 : 1;
}
function* vote(s: GameState, pi: number, c: OfficialCard): Generator<Req, number, unknown> {
  const ballots: number[] = [];
  for (const voter of s.players.filter((p) => p.id !== pi && !p.absent))
    ballots.push(
      Number(
        yield {
          kind: "choose",
          player: voter.id,
          title: `Voting rahasia · ${voter.name}`,
          text: `${c.title}\n${c.text}`,
          options: c.options,
          prefer: rand(s) < 0.5 ? 0 : 1,
        },
      ),
    );
  const result = resolveVote(ballots);
  yield notice(
    `Putusan: ${c.options[result]} (${ballots.filter((v) => v === result).length}/4)`,
    "info",
    pi,
  );
  return result;
}
function* effect(s: GameState, pi: number, text: string, area: number, surprise = false): Turn {
  const p = s.players[pi];
  if (!p) return;
  const move = text.match(/(Maju|Mundur) (\d+) petak/i);
  if (move) {
    const back = move[1]?.toLowerCase() === "mundur";
    if (back && (p.shield || p.protection === (surprise ? "surprise" : "back"))) {
      p.shield = false;
      p.protection = null;
      yield notice("Perlindungan digunakan", "good", pi);
      return;
    }
    const n = Number(move[2]) * (back ? -1 : 1);
    if (p.phase === "ring") yield* ringMove(s, pi, n);
    else yield* gateMove(s, pi, n);
  } else if (/Lewati 1 giliran/i.test(text)) {
    if (p.protection === "skip" || p.shield) {
      p.protection = null;
      p.shield = false;
    } else p.skipTurns = 1;
  } else if (/Kembalikan/i.test(text)) yield* giveBack(s, pi, 2, "Sanksi");
  else if (/Bebas.*mundur/i.test(text)) p.protection = "back";
  else if (/Bebas.*giliran/i.test(text)) p.protection = "skip";
  else if (/membatalkan.*mundur/i.test(text)) p.protection = "surprise";
  else if (/mengulang/i.test(text)) p.retry = true;
  else if (/dadu/i.test(text)) p.extraRoll = true;
  else if (/Ambil hingga 1 suara/i.test(text)) yield* give(s, pi, 1, "Kejutan", area);
  else if (/Aspirasi/i.test(text))
    yield* challenge(
      s,
      pi,
      area,
      "aspirasi",
      /Sedang/i.test(text) ? "Sedang" : "Mudah",
      /Sedang/i.test(text) ? 5 : 2,
    );
  else if (/Demokrasi/i.test(text))
    yield* challenge(
      s,
      pi,
      area,
      "demokrasi",
      /Cek Fakta/i.test(text) ? "Cek Fakta" : /Dilema/i.test(text) ? "Dilema" : "Refleksi",
      0,
    );
}
function* duel(s: GameState, pi: number, opponent: number): Turn {
  let win: number | null = null;
  for (let attempt = 0; attempt < 3 && win === null; attempt++) {
    const question = draw(s, "pentagon::", questionPool("pentagon"));
    const q = QUESTIONS.pentagon[question];
    if (!q) return;
    const answers: number[] = [];
    for (const player of [pi, opponent])
      answers.push(
        Number(
          yield {
            kind: "quiz",
            player,
            deck: "pentagon",
            question,
            stake: "Duel Demokrasi · jawaban rahasia · 20 detik",
          },
        ),
      );
    if ((answers[0] === q.answer) !== (answers[1] === q.answer))
      win = answers[0] === q.answer ? pi : opponent;
  }
  while (win === null) {
    const a = rollDie(s),
      b = rollDie(s);
    yield notice(`Dadu penentu duel: ${a} – ${b}`);
    if (a !== b) win = a > b ? pi : opponent;
  }
  const loser = win === pi ? opponent : pi;
  transfer(s, loser, win, 2);
  yield* retreat(s, loser, 2);
  yield notice(`${s.players[win]?.name} menang duel; kepemilikan tetap`, "good", win);
}
export function* land(s: GameState, pi: number): Turn {
  const p = s.players[pi];
  if (!p || p.phase === "done") return;
  const tile = TILES[p.pos];
  if (!tile) return;
  if (p.phase === "ring") {
    if (
      s.stock.every((v) => v === 0) &&
      p.areaTokens.every(Boolean) &&
      p.cash + p.eligibility < 15 &&
      ["aspirasi", "demokrasi"].includes(tile.kind)
    ) {
      const c = card(s, "D-MPS-");
      const ok = yield* officialQuiz(
        s,
        pi,
        c,
        p.missionFailures >= 2
          ? `Misi terbimbing · Acuan: ${c.options[c.answer ?? 0]}. Pilih jawaban yang menunjukkan pemahaman.`
          : "Berhasil: hingga 5 Poin Kelayakan (bukan suara)",
      );
      if (ok) {
        p.eligibility += Math.min(p.missionFailures >= 2 ? 15 : 5, 15 - p.cash - p.eligibility);
        p.missionFailures = 0;
      } else p.missionFailures++;
      return;
    }
    if (tile.kind === "aspirasi") {
      yield* challenge(
        s,
        pi,
        tile.area,
        "aspirasi",
        tile.sub,
        tile.sub === "Sulit" ? 10 : tile.sub === "Sedang" ? 5 : 2,
      );
      return;
    }
    if (tile.kind === "demokrasi") {
      if (tile.sub === "Forum") {
        yield* vote(s, pi, card(s, "D-FD-"));
        p.areaTokens[tile.area] = true;
        return;
      }
      yield* challenge(
        s,
        pi,
        tile.area,
        "demokrasi",
        tile.sub,
        tile.sub === "Cek Fakta" ? 5 : tile.sub === "Dilema" ? 2 : 0,
      );
      return;
    }
    if (tile.kind === "kejutan") {
      const c = card(s, tile.sub === "Peristiwa" ? "K-PR-" : "K-KS-");
      yield notice(`${c.title}: ${c.text}`);
      yield* effect(s, pi, c.effect, tile.area, true);
    }
    return;
  }
  if (p.phase === "gate") {
    const c = card(s, "D-PR-");
    const v = yield* vote(s, pi, c);
    yield* effect(s, pi, c.options[v] ?? "", pi);
    const seg = segmentOf(p.pos);
    p.gateFinished = seg.seg === "gate" && seg.g === 4 && !p.extraRoll;
    return;
  }
  if (tile.kind !== "plot") return; // Safe gates never trigger anything.
  const owner = s.owners[p.pos] ?? -1;
  if (p.laps === 0) {
    if (owner !== -1 || plotsOf(s, pi).length >= MAX_PLOTS || p.cash < PLEDGE + 5) return;
    const pick = yield {
      kind: "buy",
      player: pi,
      tile: p.pos,
      mode: "claim",
      options: [{ toLevel: 1, cost: 5, label: "Klaim wilayah" }],
    };
    if (pick === 0) {
      s.plotVotes[p.pos] = takeOrigins(p, 5);
      s.owners[p.pos] = pi;
      s.levels[p.pos] = 1;
      s.invested[p.pos] = 5;
      yield notice(`${p.name} menyimpan 5 suara pada wilayah`, "good", pi, 1500, "WILAYAH BARU!");
    }
    return;
  }
  const others = s.players.filter(
    (o) => o.id !== pi && o.phase === "pent" && o.laps === 1 && !o.dormant && o.pos === p.pos,
  );
  if (others.length) {
    let opponent = others[0]?.id;
    if (others.length > 1) {
      const pick = Number(
        yield {
          kind: "choose",
          player: pi,
          title: "Lawan Duel Demokrasi",
          text: "Pilih satu penghuni petak",
          options: others.map((o) => o.name),
          prefer: 0,
        },
      );
      opponent = others[pick]?.id ?? opponent;
    }
    if (opponent !== undefined) yield* duel(s, pi, opponent);
    return;
  }
  if (owner === pi) return;
  if (owner >= 0) {
    const pick = yield {
      kind: "choose",
      player: pi,
      title: "Kontribusi atau Perebutan Suara",
      text: `Wilayah ${s.players[owner]?.name} · 5 suara tersimpan`,
      options: p.cash > 0 ? ["Bayar 1 suara", "Tantangan perebutan"] : ["Tantangan perebutan"],
      prefer: p.cash > 3 ? 0 : p.cash > 0 ? 1 : 0,
    };
    if (p.cash > 0 && pick === 0) transfer(s, pi, owner, 1);
    else if (
      yield* askQuiz(s, pi, "pentagon", "Berhasil: ambil 5 suara; gagal: bayar hingga 3, mundur 2")
    ) {
      unplant(s, p.pos, pi);
      yield notice("Perebutan berhasil · petak netral", "good", pi);
    } else {
      transfer(s, pi, owner, 3);
      yield* retreat(s, pi, 2);
    }
    return;
  }
  if (
    yield* askQuiz(s, pi, "pentagon", "Tantangan individu · benar +1 dari stok, salah mundur 1")
  ) {
    const a = s.stock.findIndex((v) => v > 0);
    if (a >= 0) yield* give(s, pi, 1, "Pentagon", a);
  } else yield* retreat(s, pi, 1);
}
export function* checkDormancy(s: GameState): Turn {
  for (const p of s.players) {
    if (validVotes(s, p.id) > 0) {
      p.hadVotes = true;
      if (p.dormant && p.dormantTurns === 0) p.dormant = false;
    } else if (p.hadVotes && !p.dormant && p.phase !== "done") {
      p.dormant = true;
      p.dormantTurns = 3;
      yield notice(`${p.name} Mati Suri: lewati 3 giliran`, "bad", p.id);
    }
  }
}
function* recover(s: GameState, pi: number): Turn {
  const p = s.players[pi];
  if (!p) return;
  const targets = s.players.filter(
    (o) => o.id !== pi && !o.absent && ((o.phase !== "done" && o.cash > 0) || plotsOf(s, o.id).length),
  );
  if (!targets.length) return;
  const pick = Number(
    yield {
      kind: "choose",
      player: pi,
      title: "Tantangan Bangkit",
      text: "Pilih target yang memiliki suara sah",
      options: targets.map((o) => o.name),
      prefer: 0,
    },
  );
  const target = targets[pick] ?? targets[0];
  if (!target) return;
  let tile: number | undefined;
  if (target.cash === 0 || target.phase === "done") {
    const plots = plotsOf(s, target.id);
    const pickPlot = Number(
      yield {
        kind: "choose",
        player: pi,
        title: "Target investasi",
        text: "Pilih petak untuk mengambil 5 suara",
        options: plots.map((t) => `Petak ${t - 105 + 1}`),
        prefer: 0,
      },
    );
    tile = plots[pickPlot] ?? plots[0];
  }
  if (
    yield* askQuiz(
      s,
      pi,
      "pentagon",
      tile === undefined
        ? "Berhasil: hingga 2 suara target"
        : "Berhasil: 5 suara investasi; petak netral",
    )
  ) {
    if (tile !== undefined) unplant(s, tile, pi);
    else transfer(s, target.id, pi, 2);
    p.dormant = p.cash === 0;
  }
}
function* finalTest(s: GameState, finalists: number[]): Generator<Req, number, unknown> {
  const c = card(s, "D-FDT-");
  const statements: string[] = [];
  for (const stage of [
    { title: "Pernyataan awal", seconds: 60 },
    { title: "Bantahan", seconds: 30 },
    { title: "Jawaban akhir", seconds: 30 },
  ])
    for (const pi of finalists) {
      const response = yield {
        kind: "debate",
        player: pi,
        title: `Final Democracy Test · ${stage.title}`,
        text: `${c.title}\n${c.text}\n${c.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n")}\n${statements.join("\n")}`,
        seconds: stage.seconds,
      };
      statements.push(`${s.players[pi]?.name} · ${stage.title}: ${String(response ?? "")}`);
    }
  const ballots: number[] = [];
  for (const voter of s.players.filter((p) => !finalists.includes(p.id) && !p.absent))
    ballots.push(
      Number(
        yield {
          kind: "choose",
          player: voter.id,
          title: "Final Democracy Test · voting rahasia",
          text: statements.join("\n"),
          options: finalists.map((pi) => s.players[pi]?.name ?? ""),
          prefer: Math.floor(rand(s) * finalists.length),
        },
      ),
    );
  let remaining = [...finalists];
  if (ballots.length) {
    const totals = finalists.map((_, i) => ballots.filter((b) => b === i).length);
    const max = Math.max(...totals);
    remaining = finalists.filter((_, i) => totals[i] === max);
  }
  if (remaining.length === 1) return remaining[0] ?? 0;
  const question = draw(s, "demokrasi:objective", questionPool("demokrasi", { tag: "Cek Fakta" }));
  const q = QUESTIONS.demokrasi[question];
  const correct: number[] = [];
  for (const pi of remaining) {
    const answer = yield {
      kind: "quiz",
      player: pi,
      deck: "demokrasi",
      question,
      stake: "Pertanyaan objektif penentu seri",
    };
    if (answer === q?.answer) correct.push(pi);
  }
  if (correct.length) remaining = correct;
  while (remaining.length > 1) {
    const throws = remaining.map((pi) => ({ pi, die: rollDie(s) }));
    const max = Math.max(...throws.map((t) => t.die));
    yield notice(
      `Dadu final: ${throws.map((t) => `${s.players[t.pi]?.name} ${t.die}`).join(" · ")}`,
    );
    remaining = throws.filter((t) => t.die === max).map((t) => t.pi);
  }
  return remaining[0] ?? 0;
}
function* checkEnd(s: GameState): Turn {
  if (!s.players.every((p) => p.phase === "done")) return;
  const order = ranking(s);
  const top = validVotes(s, order[0] ?? 0);
  const finalists = order.filter((pi) => validVotes(s, pi) === top);
  s.winnerId = finalists.length === 1 ? (finalists[0] ?? 0) : yield* finalTest(s, finalists);
  s.over = true;
}
export function isOver(s: GameState) {
  return s.over;
}
export function* playTurn(s: GameState): Turn {
  if (s.over) return;
  const pi = s.turn,
    p = s.players[pi];
  if (!p) return;
  if (!s.openingShown) {
    s.openingShown = true;
    yield notice(
      `Dadu awal: ${s.players.filter((o) => !o.absent).map((o) => `${o.name} ${s.openingRolls[o.id]}`).join(" · ")}. ${p.name} mendapat giliran pertama.`,
    );
  }
  yield* checkDormancy(s);
  if (p.phase !== "done") {
    if (p.dormant) {
      if (p.dormantTurns > 0) {
        p.dormantTurns--;
        yield notice(`${p.name} Mati Suri · ${p.dormantTurns} giliran tersisa`, "info", pi);
      } else yield* recover(s, pi);
    } else if (p.skipTurns > 0) {
      p.skipTurns--;
      yield notice(`${p.name} melewati giliran`, "info", pi);
    } else {
      if (p.phase === "ring" && canEnterGate(s, pi)) {
        p.ready = false;
        p.phase = "gate";
        p.pos = ringId(pi, 8);
        yield notice(
          `${p.name} memasuki Gerbang Demokrasi`,
          "good",
          pi,
          1500,
          "GERBANG DEMOKRASI!",
        );
      } else if (p.phase === "gate" && p.gateFinished) {
        p.phase = "pent";
        p.pos = homeId(pi);
        p.laps = 0;
        p.progress = 0;
        yield { kind: "jump", player: pi, tile: p.pos };
        yield notice("Pentagon Putaran 1 dimulai", "good", pi, 1500, "PENTAGON!");
      }
      for (let rolls = 0; rolls < 2; rolls++) {
        p.extraRoll = false;
        const oldLaps = p.laps;
        const die = Number(yield { kind: "roll", player: pi });
        s.lastDice = die;
        yield* walk(s, pi, die);
        if (p.laps === oldLaps) yield* land(s, pi);
        yield* checkDormancy(s);
        if (!p.extraRoll || p.dormant || p.laps >= 2 || p.laps !== oldLaps) break;
      }
      p.extraRoll = false;
      if (p.phase === "gate") {
        const seg = segmentOf(p.pos);
        p.gateFinished = seg.seg === "gate" && seg.g === 4;
      }
      if (p.phase === "ring") p.ready = canEnterGate(s, pi);
    }
  }
  yield* checkDormancy(s);
  yield* checkEnd(s);
  if (!s.over) {
    const seated = s.players.filter((o) => !o.absent).length;
    do s.turn = (s.turn + 1) % s.players.length;
    while (s.players[s.turn]?.absent);
    s.turnsInRound++;
    if (s.turnsInRound >= seated) {
      s.round++;
      s.turnsInRound = 0;
    }
  }
}
export function winner(s: GameState) {
  return s.winnerId ?? ranking(s)[0] ?? 0;
}
export { RING_LEN };
