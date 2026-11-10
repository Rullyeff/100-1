// Turn flow as a generator: it mutates the GameState and yields requests.
// The UI controller answers them (with animation pauses and player input);
// tests answer them synchronously with the bot.
import {
  BOARD_SIZE,
  ISLAND_INDEX,
  ISLAND_TURNS,
  LEVEL_NAMES,
  SALARY,
  TILES,
  TRAVEL_INDEX,
} from "./board";
import {
  alivePlayers,
  propertiesOf,
  propertyValue,
  rand,
  ranking,
  releaseProperty,
  sellValue,
  takeoverPrice,
  tollOf,
  upgradeCost,
  type GameState,
} from "./state";
import { fmt } from "./format";
import { eventForRound } from "./events";

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
      /** Big cinematic headline for key moments (presentation only). */
      banner?: string | undefined;
    }
  | {
      kind: "buy";
      player: number;
      tile: number;
      mode: "buy" | "upgrade" | "takeover";
      options: BuyOption[];
    }
  | { kind: "pick"; player: number; purpose: "festival" | "travel"; tiles: number[] };

/** Answer types: roll -> [d1, d2], buy -> option index or -1, pick -> tile index, others -> undefined. */
export type Turn = Generator<Req, void, unknown>;

const notice = (text: string, tone: Tone = "info", player?: number, ms?: number, banner?: string): Req => ({
  kind: "notice",
  text,
  tone,
  player,
  ms,
  banner,
});

/** True when `pi` owns every city of the tile's colour group. */
function ownsGroup(s: GameState, pi: number, tile: number): boolean {
  const g = TILES[tile]!.group;
  return TILES.every((t, i) => t.kind !== "city" || t.group !== g || s.owners[i] === pi);
}

interface Card {
  text: string;
  tone: Tone;
  apply: (s: GameState, pi: number) => Turn;
}

export const CHANCE_CARDS: Card[] = [
  { text: "Hadiah ulang tahun! +150K", tone: "good", apply: function* (s, pi) { s.players[pi]!.cash += 150; } },
  { text: "Menang lotre! +300K", tone: "good", apply: function* (s, pi) { s.players[pi]!.cash += 300; } },
  { text: "Kena tilang. Bayar 100K", tone: "bad", apply: function* (s, pi) { yield* pay(s, pi, 100, -1); } },
  {
    text: "Pajak kekayaan: bayar 5% asetmu",
    tone: "bad",
    apply: function* (s, pi) {
      const amt = Math.max(20, Math.round((s.players[pi]!.cash + propertyValue(s, pi)) * 0.05));
      yield* pay(s, pi, amt, -1);
    },
  },
  {
    text: "Kartu Malaikat! Bebas bayar sewa sekali",
    tone: "good",
    apply: function* (s, pi) { s.players[pi]!.shield = true; },
  },
  {
    text: "Pulang ke START",
    tone: "good",
    apply: function* (s, pi) { yield* jumpTo(s, pi, 0); yield* land(s, pi); },
  },
  {
    text: "Kapal karam! Terdampar di pulau",
    tone: "bad",
    apply: function* (s, pi) { yield* jumpTo(s, pi, ISLAND_INDEX, false); yield* land(s, pi); },
  },
  {
    text: "Tiket pesawat ke Keliling Dunia",
    tone: "good",
    apply: function* (s, pi) { yield* jumpTo(s, pi, TRAVEL_INDEX); yield* land(s, pi); },
  },
  { text: "Maju 3 langkah", tone: "info", apply: function* (s, pi) { yield* moveBy(s, pi, 3); yield* land(s, pi); } },
  {
    text: "Mundur 3 langkah",
    tone: "info",
    apply: function* (s, pi) {
      const p = s.players[pi]!;
      for (let i = 0; i < 3; i++) {
        p.pos = (p.pos - 1 + BOARD_SIZE) % BOARD_SIZE;
        yield { kind: "step", player: pi, tile: p.pos, salary: false };
      }
      yield* land(s, pi);
    },
  },
  {
    text: "Arisan! Semua pemain memberimu 50K",
    tone: "good",
    apply: function* (s, pi) {
      for (const other of alivePlayers(s)) {
        if (other === pi) continue;
        yield* pay(s, other, 50, pi);
      }
    },
  },
];

const BONUS_AMOUNTS = [50, 100, 150, 200, 300];

export function* moveBy(s: GameState, pi: number, steps: number): Turn {
  const p = s.players[pi]!;
  for (let i = 0; i < steps; i++) {
    p.pos = (p.pos + 1) % BOARD_SIZE;
    const salary = p.pos === 0;
    if (salary) p.cash += SALARY;
    yield { kind: "step", player: pi, tile: p.pos, salary };
  }
}

/** Teleport; pays salary when the jump wraps past Start (if `salary`). */
export function* jumpTo(s: GameState, pi: number, tile: number, salary = true): Turn {
  const p = s.players[pi]!;
  const wraps = tile <= p.pos;
  p.pos = tile;
  yield { kind: "jump", player: pi, tile };
  if (salary && wraps) {
    p.cash += SALARY;
    yield notice(`Lewat START: gaji +${fmt(SALARY)}`, "good", pi, 700);
  }
}

/** Pay `amount`; force-sells properties if short; bankrupts if still short. creditor -1 = bank. */
export function* pay(s: GameState, pi: number, amount: number, creditor: number): Turn {
  const p = s.players[pi]!;
  if (p.bankrupt) return;
  if (p.cash < amount) {
    const props = propertiesOf(s, pi).sort((a, b) => s.invested[a]! - s.invested[b]!);
    for (const t of props) {
      if (p.cash >= amount) break;
      const v = sellValue(s, t);
      p.cash += v;
      releaseProperty(s, t);
      yield notice(`${p.name} menjual ${TILES[t]!.name} (+${fmt(v)})`, "bad", pi);
    }
  }
  if (p.cash >= amount) {
    p.cash -= amount;
    if (creditor >= 0) s.players[creditor]!.cash += amount;
    return;
  }
  // Bankrupt: hand over whatever is left.
  if (creditor >= 0) s.players[creditor]!.cash += p.cash;
  p.cash = 0;
  p.bankrupt = true;
  for (const t of propertiesOf(s, pi)) releaseProperty(s, t);
  yield notice(`${p.name} kehabisan uang`, "bad", pi, 1800, "BANGKRUT!");
}

function buyOptions(s: GameState, pi: number, tile: number): BuyOption[] {
  const from = s.levels[tile]!;
  const max = from === 3 ? 4 : 3; // landmark only once a hotel stands
  const out: BuyOption[] = [];
  for (let l = from + 1; l <= max; l++) {
    const cost = upgradeCost(tile, from, l);
    if (cost <= s.players[pi]!.cash) out.push({ toLevel: l, cost, label: LEVEL_NAMES[l]! });
  }
  return out;
}

export function* land(s: GameState, pi: number): Turn {
  const p = s.players[pi]!;
  const t = p.pos;
  const tile = TILES[t]!;

  switch (tile.kind) {
    case "city": {
      const owner = s.owners[t]!;
      if (owner === -1 || owner === pi) {
        if (owner === pi && s.levels[t]! >= 4) {
          yield notice(`Landmark ${tile.name} sudah berdiri megah`, "info", pi);
          return;
        }
        const options = buyOptions(s, pi, t);
        if (options.length === 0) {
          yield notice("Uang tidak cukup untuk membangun", "bad", pi);
          return;
        }
        const mode = owner === -1 ? "buy" : "upgrade";
        const choice = (yield { kind: "buy", player: pi, tile: t, mode, options }) as number;
        if (choice >= 0 && options[choice]!) {
          const o = options[choice]!;
          p.cash -= o.cost;
          s.owners[t] = pi;
          s.levels[t] = o.toLevel;
          s.invested[t] = s.invested[t]! + o.cost;
          if (o.toLevel >= 4) yield notice(`${p.name} membangun Landmark di ${tile.name}`, "good", pi, 1700, "LANDMARK!");
          else yield notice(`${p.name} membangun ${o.label} di ${tile.name}`, "good", pi, undefined, mode === "buy" ? "KOTA BARU!" : undefined);
          if (mode === "buy" && ownsGroup(s, pi, t))
            yield notice(`${p.name} menguasai semua kota warna ini`, "good", pi, 1700, "MONOPOLI WARNA!");
        }
        return;
      }
      // Someone else's city: pay toll, then maybe take it over.
      const toll = tollOf(s, t);
      const ownerName = s.players[owner]!.name;
      if (p.shield) {
        p.shield = false;
        yield notice(`Kartu Malaikat melindungi ${p.name}!`, "good", pi);
      } else {
        yield notice(`${p.name} bayar sewa ${fmt(toll)} ke ${ownerName}`, "bad", pi);
        yield* pay(s, pi, toll, owner);
      }
      if (p.bankrupt || s.levels[t]! >= 4 || s.owners[t] !== owner) return;
      const price = takeoverPrice(s, t);
      if (p.cash < price) return;
      const choice = (yield {
        kind: "buy",
        player: pi,
        tile: t,
        mode: "takeover",
        options: [{ toLevel: s.levels[t]!, cost: price, label: "Ambil alih" }],
      }) as number;
      if (choice === 0) {
        p.cash -= price;
        s.players[owner]!.cash += price;
        s.owners[t] = pi;
        yield notice(`${p.name} merebut ${tile.name} dari ${ownerName}`, "good", pi, 1700, "AMBIL ALIH!");
        if (ownsGroup(s, pi, t)) yield notice(`${p.name} menguasai semua kota warna ini`, "good", pi, 1700, "MONOPOLI WARNA!");
      }
      return;
    }
    case "chance": {
      const card = CHANCE_CARDS[Math.floor(rand(s) * CHANCE_CARDS.length)]!;
      yield notice(`Kesempatan: ${card.text}`, card.tone, pi, 1500);
      yield* card.apply(s, pi);
      return;
    }
    case "bonus": {
      const amt = BONUS_AMOUNTS[Math.floor(rand(s) * BONUS_AMOUNTS.length)]!;
      p.cash += amt;
      yield notice(`Bonus! ${p.name} dapat ${fmt(amt)}`, "good", pi);
      return;
    }
    case "tax": {
      const amt = Math.max(30, Math.round(propertyValue(s, pi) * 0.1));
      yield notice(`Pajak properti: bayar ${fmt(amt)}`, "bad", pi);
      yield* pay(s, pi, amt, -1);
      return;
    }
    case "island": {
      p.island = ISLAND_TURNS;
      yield notice(`${p.name} terdampar di Pulau Terpencil`, "bad", pi, 1600, "TERDAMPAR!");
      return;
    }
    case "worldcup": {
      const mine = propertiesOf(s, pi);
      if (mine.length === 0) {
        yield notice("Piala Dunia: belum punya kota untuk jadi tuan rumah", "info", pi);
        return;
      }
      const pick = (yield { kind: "pick", player: pi, purpose: "festival", tiles: mine }) as number;
      if (mine.includes(pick)) {
        s.festival = pick;
        yield notice(`Piala Dunia di ${TILES[pick]!.name}: sewa x2`, "good", pi, 1600, "PIALA DUNIA!");
      }
      return;
    }
    case "travel": {
      p.travel = true;
      yield notice("Giliran depan: terbang ke kota mana saja", "good", pi);
      return;
    }
    case "start":
      return;
  }
}

export function isOver(s: GameState): boolean {
  return s.over;
}

function advanceTurn(s: GameState) {
  const alive = alivePlayers(s);
  if (alive.length <= 1) {
    s.over = true;
    return;
  }
  let next = s.turn;
  do {
    next = (next + 1) % s.players.length;
    if (next === 0) {
      s.round += 1;
      s.boardEvent = eventForRound(s.round);
    }
  } while (s.players[next]!.bankrupt);
  if (s.round > s.maxRounds) {
    s.round = s.maxRounds;
    s.over = true;
    return;
  }
  s.turn = next;
}

export function* playTurn(s: GameState): Turn {
  const pi = s.turn;
  const p = s.players[pi]!;
  if (!p.bankrupt && !s.over) {
    if (p.travel) {
      p.travel = false;
      const tiles = TILES.filter((t) => t.id !== TRAVEL_INDEX).map((t) => t.id);
      const pick = (yield { kind: "pick", player: pi, purpose: "travel", tiles }) as number;
      const dest = tiles.includes(pick) ? pick : 0;
      yield notice(`${p.name} terbang ke ${TILES[dest]!.name}`, "info", pi, 800);
      yield* jumpTo(s, pi, dest);
      yield* land(s, pi);
    } else {
      let doubles = 0;
      while (true) {
        const dice = (yield { kind: "roll", player: pi }) as [number, number];
        s.lastDice = dice;
        const [a, b] = dice;
        const dbl = a === b;
        if (p.island > 0) {
          if (dbl) {
            p.island = 0;
            yield notice("Berhasil kabur dari pulau", "good", pi, 1400, "DOUBLE!");
            yield* moveBy(s, pi, a + b);
            yield* land(s, pi);
          } else {
            p.island -= 1;
            yield notice(
              p.island === 0 ? "Kapal penyelamat datang giliran depan" : `Masih terdampar ${p.island} giliran`,
              "bad",
              pi,
            );
          }
          break;
        }
        yield* moveBy(s, pi, a + b);
        yield* land(s, pi);
        if (dbl && !p.bankrupt && p.island === 0 && !p.travel && doubles < 2) {
          doubles++;
          yield notice("Dadu kembar, lempar lagi", "good", pi, 1400, "DOUBLE!");
          continue;
        }
        break;
      }
    }
  }
  advanceTurn(s);
}

export function winner(s: GameState): number {
  return ranking(s)[0]!;
}
