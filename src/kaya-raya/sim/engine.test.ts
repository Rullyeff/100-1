import { describe, expect, it } from "vitest";
import { SALARY, START_CASH, TILES } from "./board";
import { botAnswer } from "./bot";
import { land, moveBy, pay, playTurn, type Turn } from "./engine";
import { createGame, propertiesOf, takeoverPrice, tollOf, totalAssets, type GameState } from "./state";

/** Drive a generator with bot answers (optionally scripted dice). */
function drive(s: GameState, gen: Turn, dice: [number, number][] = []) {
  let r = gen.next();
  while (!r.done) {
    const req = r.value;
    const ans = req.kind === "roll" && dice.length ? dice.shift() : botAnswer(s, req);
    r = gen.next(ans);
  }
}

describe("rules", () => {
  it("pays salary when passing Start", () => {
    const s = createGame(1, 0);
    s.players[0]!.pos = 30;
    drive(s, moveBy(s, 0, 4));
    expect(s.players[0]!.pos).toBe(2);
    expect(s.players[0]!.cash).toBe(START_CASH + SALARY);
  });

  it("charges toll to the owner and doubles it during the festival", () => {
    const s = createGame(1, 0);
    s.boardEvent = null; // Isolate the existing World Cup rule from temporary city events.
    const jakarta = TILES.findIndex((t) => t.name === "Jakarta");
    s.owners[jakarta] = 1;
    s.levels[jakarta] = 1;
    s.invested[jakarta] = 180;
    expect(tollOf(s, jakarta)).toBe(96); // 120 * 0.8
    s.festival = jakarta;
    expect(tollOf(s, jakarta)).toBe(192);
    expect(takeoverPrice(s, jakarta)).toBe(360);
  });

  it("bankrupts a player who cannot pay and gives the rest to the creditor", () => {
    const s = createGame(1, 0);
    s.players[0]!.cash = 50;
    drive(s, pay(s, 0, 500, 1));
    expect(s.players[0]!.bankrupt).toBe(true);
    expect(s.players[1]!.cash).toBe(START_CASH + 50);
  });

  it("force-sells property before going bankrupt", () => {
    const s = createGame(1, 0);
    s.players[0]!.cash = 0;
    s.owners[1] = 0;
    s.levels[1] = 0;
    s.invested[1] = 400;
    drive(s, pay(s, 0, 100, -1));
    expect(s.players[0]!.bankrupt).toBe(false);
    expect(s.players[0]!.cash).toBe(100); // sold for 200, paid 100
    expect(propertiesOf(s, 0)).toEqual([]);
  });

  it("strands a player on the island", () => {
    const s = createGame(1, 0);
    s.players[0]!.pos = 8;
    drive(s, land(s, 0));
    expect(s.players[0]!.island).toBe(3);
  });
});

describe("full bot games", () => {
  it.each([1, 2, 3, 42, 99])("seed %i finishes with sane money", (seed) => {
    const s = createGame(seed, 0);
    let turns = 0;
    while (!s.over && turns < 2000) {
      drive(s, playTurn(s));
      turns++;
      for (const p of s.players) expect(p.cash).toBeGreaterThanOrEqual(0);
    }
    expect(s.over).toBe(true);
    const ranks = s.players.map((p) => totalAssets(s, p.id));
    expect(ranks.some((v) => v > 0)).toBe(true);
  });
});

describe("big-moment banners", () => {
  function banners(s: GameState, gen: Turn) {
    const out: string[] = [];
    let r = gen.next();
    while (!r.done) {
      const req = r.value;
      if (req.kind === "notice" && req.banner) out.push(req.banner);
      r = gen.next(req.kind === "buy" ? 0 : botAnswer(s, req));
    }
    return out;
  }

  it("announces a colour monopoly when the last city of a group is bought", () => {
    const s = createGame(1, 0);
    const group = TILES.map((t, i) => ({ t, i })).filter(({ t }) => t.kind === "city" && t.group === TILES[1]!.group);
    const [last, ...rest] = group.map((g) => g.i);
    for (const i of rest) s.owners[i] = 0;
    s.players[0]!.pos = last!;
    expect(banners(s, land(s, 0))).toContain("MONOPOLI WARNA!");
  });

  it("announces a takeover", () => {
    const s = createGame(1, 0);
    s.owners[1] = 1;
    s.levels[1] = 1;
    s.invested[1] = 100;
    s.players[0]!.pos = 1;
    expect(banners(s, land(s, 0))).toContain("AMBIL ALIH!");
    expect(s.owners[1]).toBe(0);
  });
});
