import { describe, expect, it } from "vitest";
import { AREA_STOCK, BOARD_SIZE, PLEDGE, TILES, gateId, homeId, pentId, ringId } from "./board";
import { botAnswer } from "./bot";
import {
  canEnterGate,
  checkDormancy,
  give,
  giveBack,
  land,
  playTurn,
  resolveVote,
  transfer,
  walk,
  type Req,
  type Turn,
} from "./engine";
import { QUESTIONS } from "./quiz";
import {
  createGame as createOfficialGame,
  plotsOf,
  validVotes,
  votesInPlay,
  type GameState,
} from "./state";
function createGame(seed = 1, humanCount = 1) {
  const s = createOfficialGame(seed, humanCount);
  s.turn = 0;
  return s;
}
type Answer = (req: Req) => unknown;
function player(s: GameState, i: number) {
  const p = s.players[i];
  if (!p) throw Error("missing player");
  return p;
}
function plotVotes(s: GameState, t: number) {
  const v = s.plotVotes[t];
  if (!v) throw Error("missing origins");
  return v;
}
/** First outer tile of an area with this kind/sub, so tests follow the board layout. */
function outer(area: number, kind: string, sub?: string) {
  const t = TILES.find((t) => t.area === area && t.id < 80 && t.kind === kind && (!sub || t.sub === sub));
  if (!t) throw Error(`no ${kind} ${sub ?? ""} tile`);
  return t.id;
}
function drive(s: GameState, gen: Turn, answer: Answer = () => undefined) {
  let r = gen.next();
  let count = 0;
  while (!r.done) {
    if (count++ > 2000) throw new Error("Generator stalled");
    const a = answer(r.value);
    r = gen.next(a === undefined ? botAnswer(s, r.value) : a);
  }
}
const correct: Answer = (r) =>
  r.kind === "quiz" ? QUESTIONS[r.deck][r.question]?.answer : undefined;
const wrong: Answer = (r) =>
  r.kind === "quiz" ? ((QUESTIONS[r.deck][r.question]?.answer ?? 0) + 1) % 4 : undefined;
function pent(laps = 0) {
  const s = createGame(1, 0);
  s.stock.fill(0);
  for (const p of s.players) {
    p.cash = 20;
    p.votes[p.id] = 20;
    p.hadVotes = true;
    p.phase = "pent";
    p.laps = laps;
    p.pos = homeId(p.id);
  }
  return s;
}
function plant(s: GameState, pi: number, index: number) {
  const t = pentId(index),
    p = s.players[pi];
  if (!p) return t;
  p.cash -= 5;
  p.votes[pi] = (p.votes[pi] ?? 0) - 5;
  s.owners[t] = pi;
  s.invested[t] = 5;
  plotVotes(s, t)[pi] = 5;
  return t;
}
describe("V4 board and initial state", () => {
  it("highest opening die determines first player", () => {
    const s = createOfficialGame(42);
    expect(s.openingRolls[s.turn]).toBe(Math.max(...s.openingRolls));
  });
  it("contains 75 outer, 25 gate, 20 Pentagon and five separate starts", () => {
    expect(BOARD_SIZE).toBe(125);
    expect(TILES.filter((t) => t.kind === "start")).toHaveLength(5);
    expect(TILES.filter((t) => t.kind === "gate")).toHaveLength(25);
    expect(TILES.filter((t) => t.kind === "plot")).toHaveLength(15);
    expect(TILES.filter((t) => t.kind === "home")).toHaveLength(5);
  });
  it("every area has 2 easy, 2 medium, 1 hard Aspirasi like the printed board", () => {
    for (let a = 0; a < 5; a++) {
      const t = TILES.filter((t) => t.area === a && t.id < 80);
      expect(t.filter((t) => t.kind === "aspirasi" && t.sub === "Mudah")).toHaveLength(2);
      expect(t.filter((t) => t.kind === "aspirasi" && t.sub === "Sedang")).toHaveLength(2);
      expect(t.filter((t) => t.kind === "aspirasi" && t.sub === "Sulit")).toHaveLength(1);
    }
  });
  it("every area has three democracy, two surprise and five empty tiles", () => {
    for (let a = 0; a < 5; a++) {
      const t = TILES.filter((t) => t.area === a && t.id < 80);
      expect(t.filter((t) => t.kind === "demokrasi")).toHaveLength(3);
      expect(t.filter((t) => t.kind === "kejutan" && t.sub === "Peristiwa")).toHaveLength(1);
      expect(t.filter((t) => t.kind === "kejutan" && t.sub === "Kesempatan")).toHaveLength(1);
      expect(t.filter((t) => t.kind === "warga")).toHaveLength(5);
    }
  });
  it("landing on an empty outer tile triggers nothing", () => {
    const s = createGame();
    const t = TILES.find((t) => t.area === 1 && t.kind === "warga");
    if (!t) throw Error("tile");
    player(s, 0).pos = t.id;
    const before = structuredClone(s);
    const reqs: unknown[] = [];
    drive(s, land(s, 0), (r) => {
      reqs.push(r);
      return undefined;
    });
    expect(reqs).toEqual([]);
    expect(s.players).toEqual(before.players);
    expect(s.stock).toEqual(before.stock);
  });
  it("five players start with zero votes and tokens; stocks are 20 each", () => {
    const s = createGame();
    expect(s.players).toHaveLength(5);
    expect(s.players.every((p) => p.cash === 0 && p.areaTokens.every((v) => !v))).toBe(true);
    expect(s.stock).toEqual([20, 20, 20, 20, 20]);
    expect(votesInPlay(s)).toBe(100);
  });
});
describe("Outer path and eligibility", () => {
  it("crosses to the next area without activating its START", () => {
    const s = createGame();
    player(s, 0).pos = ringId(0, 15);
    drive(s, walk(s, 0, 2));
    expect(player(s, 0).pos).toBe(ringId(1, 2));
  });
  it.each([
    ["Mudah", 2],
    ["Sedang", 5],
    ["Sulit", 10],
  ] as const)("%s rewards %i from landed area", (tag, reward) => {
    const s = createGame();
    const t = TILES.find((t) => t.area === 2 && t.kind === "aspirasi" && t.sub === tag);
    if (!t) throw Error("tile");
    player(s, 0).pos = t.id;
    drive(s, land(s, 0), correct);
    expect(player(s, 0).cash).toBe(reward);
    expect(s.stock[2]).toBe(AREA_STOCK - reward);
    expect(s.stock[0]).toBe(20);
    expect(player(s, 0).areaTokens[2]).toBe(true);
    expect(votesInPlay(s)).toBe(100);
  });
  it("wrong answers award no votes or Token Area", () => {
    const s = createGame();
    player(s, 0).pos = outer(0, "aspirasi", "Mudah");
    drive(s, land(s, 0), wrong);
    expect(player(s, 0).cash).toBe(0);
    expect(player(s, 0).areaTokens[0]).toBe(false);
  });
  it("correct answers grant Token Area even if stock is empty", () => {
    const s = createGame();
    s.stock[0] = 0;
    player(s, 0).pos = outer(0, "aspirasi", "Mudah");
    drive(s, land(s, 0), correct);
    expect(player(s, 0).cash).toBe(0);
    expect(player(s, 0).areaTokens[0]).toBe(true);
  });
  it("requires five Token Area plus 15 votes", () => {
    const s = createGame();
    player(s, 0).cash = 15;
    expect(canEnterGate(s, 0)).toBe(false);
    player(s, 0).areaTokens.fill(true);
    expect(canEnterGate(s, 0)).toBe(true);
    player(s, 0).cash = 14;
    expect(canEnterGate(s, 0)).toBe(false);
  });
  it("emergency points count only toward entry with all stocks empty", () => {
    const s = createGame();
    const p = player(s, 0);
    p.areaTokens.fill(true);
    p.cash = 10;
    p.eligibility = 5;
    expect(canEnterGate(s, 0)).toBe(false);
    s.stock.fill(0);
    expect(canEnterGate(s, 0)).toBe(true);
    expect(validVotes(s, 0)).toBe(10);
  });
  it("emergency mission gives at most five points and caps at deficit", () => {
    const s = createGame();
    s.stock.fill(0);
    const p = player(s, 0);
    p.areaTokens.fill(true);
    p.cash = 12;
    p.pos = outer(0, "aspirasi", "Mudah");
    drive(s, land(s, 0));
    expect(p.eligibility).toBe(3);
    expect(p.cash).toBe(12);
  });
  it("transferred tokens return to their original area stock", () => {
    const s = createGame();
    drive(s, give(s, 0, 5, "reward", 2));
    transfer(s, 0, 1, 3);
    drive(s, giveBack(s, 1, 3, "sanction"));
    expect(s.stock[2]).toBe(18);
    expect(s.stock[1]).toBe(20);
    expect(votesInPlay(s)).toBe(100);
  });
  it("Cek Fakta grants five votes and Token Area", () => {
    const s = createGame();
    player(s, 0).pos = outer(0, "demokrasi", "Cek Fakta");
    drive(s, land(s, 0), correct);
    expect(player(s, 0).cash).toBe(5);
    expect(player(s, 0).areaTokens[0]).toBe(true);
  });
  it("Dilema grants two votes and Token Area", () => {
    const s = createGame();
    player(s, 0).pos = outer(0, "demokrasi", "Dilema");
    drive(s, land(s, 0), correct);
    expect(player(s, 0).cash).toBe(2);
  });
  it("Forum uses four voters without moving vote tokens", () => {
    const s = createGame();
    player(s, 0).pos = outer(0, "demokrasi", "Forum");
    const voters: number[] = [];
    drive(s, land(s, 0), (r) => {
      if (r.kind === "choose") {
        voters.push(r.player);
        return 0;
      }
      return undefined;
    });
    expect(voters).toEqual([1, 2, 3, 4]);
    expect(player(s, 0).areaTokens[0]).toBe(true);
    expect(votesInPlay(s)).toBe(100);
  });
});
describe("Democracy gate", () => {
  it("overroll stops on the fifth tile without entering Pentagon", () => {
    const s = createGame();
    const p = player(s, 0);
    p.phase = "gate";
    p.pos = gateId(0, 3);
    drive(s, walk(s, 0, 6));
    expect(p.pos).toBe(gateId(0, 4));
    expect(p.phase).toBe("gate");
  });
  it("2–2 uses the lighter option, majority otherwise", () => {
    expect(resolveVote([0, 1, 0, 1])).toBe(0);
    expect(resolveVote([0, 1, 1, 1])).toBe(1);
  });
  it("every Putusan is decided by the other four players", () => {
    const s = createGame();
    player(s, 0).phase = "gate";
    player(s, 0).pos = gateId(0, 0);
    const voters: number[] = [];
    drive(s, land(s, 0), (r) => {
      if (r.kind === "choose") {
        voters.push(r.player);
        return 0;
      }
      return undefined;
    });
    expect(voters).toEqual([1, 2, 3, 4]);
  });
  it("never gives more than one bonus throw in a turn", () => {
    const s = createGame();
    player(s, 0).phase = "gate";
    player(s, 0).pos = gateId(0, 0);
    let rolls = 0;
    drive(s, playTurn(s), (r) => {
      if (r.kind === "roll") {
        rolls++;
        return 1;
      }
      if (r.kind === "choose") return 1;
      return undefined;
    });
    expect(rolls).toBeLessThanOrEqual(2);
  });
});
describe("Pentagon V4", () => {
  it("claims five votes, preserves valid total and keeps at least five in hand", () => {
    const s = pent();
    player(s, 0).pos = pentId(1);
    drive(s, land(s, 0), (r) => (r.kind === "buy" ? 0 : undefined));
    expect(s.invested[pentId(1)]).toBe(5);
    expect(player(s, 0).cash).toBe(15);
    expect(validVotes(s, 0)).toBe(20);
    expect(votesInPlay(s)).toBe(100);
  });
  it("cannot claim with nine votes", () => {
    const s = pent();
    player(s, 0).cash = 9;
    player(s, 0).pos = pentId(1);
    drive(s, land(s, 0));
    expect(s.owners[pentId(1)]).toBe(-1);
  });
  it("limits ownership to three plots", () => {
    const s = pent();
    for (const i of [1, 2, 3]) plant(s, 0, i);
    player(s, 0).cash = 20;
    player(s, 0).pos = pentId(5);
    drive(s, land(s, 0));
    expect(plotsOf(s, 0)).toHaveLength(3);
  });
  it("safe gates do not trigger a duel, claim or contribution", () => {
    const s = pent(1);
    player(s, 0).pos = homeId(1);
    player(s, 1).pos = homeId(1);
    let requests = 0;
    drive(s, land(s, 0), () => {
      requests++;
    });
    expect(requests).toBe(0);
  });
  it("stops exactly at origin after first lap and discards overshoot", () => {
    const s = pent();
    player(s, 0).pos = pentId(18);
    drive(s, walk(s, 0, 6));
    expect(player(s, 0).laps).toBe(1);
    expect(player(s, 0).progress).toBe(0);
    expect(player(s, 0).pos).toBe(homeId(0));
    expect(player(s, 0).phase).toBe("pent");
  });
  it("stops after second lap", () => {
    const s = pent(1);
    player(s, 0).pos = pentId(18);
    drive(s, walk(s, 0, 6));
    expect(player(s, 0).phase).toBe("done");
    expect(player(s, 0).pos).toBe(homeId(0));
  });
  it("successful seizure takes all five investment votes and neutralizes plot", () => {
    const s = pent(1);
    const t = plant(s, 1, 9);
    player(s, 0).pos = t;
    drive(s, land(s, 0), (r) => (r.kind === "choose" ? 1 : correct(r)));
    expect(s.owners[t]).toBe(-1);
    expect(s.invested[t]).toBe(0);
    expect(player(s, 0).cash).toBe(25);
    expect(votesInPlay(s)).toBe(100);
  });
  it("failed seizure pays three from hand and retreats two", () => {
    const s = pent(1);
    const t = plant(s, 1, 9);
    player(s, 0).pos = t;
    drive(s, land(s, 0), (r) => (r.kind === "choose" ? 1 : wrong(r)));
    expect(player(s, 0).cash).toBe(17);
    expect(player(s, 1).cash).toBe(18);
    expect(player(s, 0).pos).toBe(pentId(7));
    expect(s.owners[t]).toBe(1);
  });
  it("contribution transfers one vote without changing investment", () => {
    const s = pent(1);
    const t = plant(s, 1, 9);
    player(s, 0).pos = t;
    drive(s, land(s, 0), (r) => (r.kind === "choose" ? 0 : undefined));
    expect(player(s, 0).cash).toBe(19);
    expect(s.invested[t]).toBe(5);
  });
  it("duel uses same question and takes priority over plot interaction", () => {
    const s = pent(1);
    const t = plant(s, 2, 9);
    player(s, 0).pos = t;
    player(s, 1).pos = t;
    const questions: number[] = [];
    drive(s, land(s, 0), (r) => {
      if (r.kind === "quiz") {
        questions.push(r.question);
        return r.player === 0 ? correct(r) : wrong(r);
      }
      return undefined;
    });
    expect(questions).toHaveLength(2);
    expect(questions[0]).toBe(questions[1]);
    expect(s.owners[t]).toBe(2);
    expect(player(s, 0).cash).toBe(22);
    expect(player(s, 1).cash).toBe(18);
  });
  it("neutral second-lap plot cannot be claimed; failure retreats one", () => {
    const s = pent(1);
    player(s, 0).pos = pentId(1);
    drive(s, land(s, 0), wrong);
    expect(s.owners[pentId(1)]).toBe(-1);
    expect(player(s, 0).pos).toBe(homeId(0));
  });
  it("first-lap occupants never duel", () => {
    const s = pent();
    player(s, 0).pos = pentId(1);
    player(s, 1).pos = pentId(1);
    let quiz = 0;
    drive(s, land(s, 0), (r) => {
      if (r.kind === "quiz") quiz++;
      return -1;
    });
    expect(quiz).toBe(0);
  });
});
describe("Dormancy and game end", () => {
  it("one round is five turns even if the starter is not seat zero", () => {
    const s = createGame();
    s.turn = 2;
    for (let i = 0; i < 5; i++) drive(s, playTurn(s), (r) => (r.kind === "roll" ? 1 : correct(r)));
    expect(s.round).toBe(2);
    expect(s.turn).toBe(2);
  });
  it("zero at start does not trigger Mati Suri", () => {
    const s = createGame();
    drive(s, checkDormancy(s));
    expect(s.players.every((p) => !p.dormant)).toBe(true);
  });
  it("zero hand with owned investment does not trigger Mati Suri", () => {
    const s = pent();
    plant(s, 0, 1);
    player(s, 0).cash = 0;
    drive(s, checkDormancy(s));
    expect(player(s, 0).dormant).toBe(false);
  });
  it("loss of all valid votes skips exactly three turns then offers recovery", () => {
    const s = pent(1);
    const p = player(s, 0);
    p.cash = 0;
    p.votes.fill(0);
    drive(s, checkDormancy(s));
    expect(p.dormantTurns).toBe(3);
    for (let i = 0; i < 3; i++) {
      s.turn = 0;
      let roll = false;
      drive(s, playTurn(s), (r) => {
        if (r.kind === "roll") roll = true;
      });
      expect(roll).toBe(false);
    }
    expect(p.dormantTurns).toBe(0);
    s.turn = 0;
    drive(s, playTurn(s), correct);
    expect(p.cash).toBe(2);
    expect(p.dormant).toBe(false);
  });
  it("ends only after all five finish, without 50-vote threshold", () => {
    const s = pent(2);
    s.players.forEach((p) => (p.phase = "done"));
    player(s, 0).cash = 24;
    player(s, 1).cash = 16;
    drive(s, playTurn(s));
    expect(s.over).toBe(true);
    expect(s.winnerId).toBe(0);
    expect(s.lapGoal).toBe(2);
  });
  it("does not end when one player is unfinished", () => {
    const s = pent(2);
    s.players.forEach((p) => (p.phase = "done"));
    player(s, 4).phase = "pent";
    drive(s, playTurn(s));
    expect(s.over).toBe(false);
  });
  it("ties use a Final Democracy Test without extra laps", () => {
    const s = pent(2);
    s.players.forEach((p) => (p.phase = "done"));
    let debate = 0;
    drive(s, playTurn(s), (r) => {
      if (r.kind === "debate") debate++;
      return correct(r);
    });
    expect(debate).toBe(15);
    expect(s.over).toBe(true);
    expect(s.winnerId).not.toBeNull();
    expect(s.lapGoal).toBe(2);
  });
});
describe("full bot games", () => {
  it.each([1, 2, 3, 42, 99])("seed %i conserves 100 tokens and completes two laps", (seed) => {
    const s = createGame(seed, 0);
    let turns = 0;
    while (!s.over && turns < 20000) {
      drive(s, playTurn(s));
      turns++;
      expect(votesInPlay(s)).toBe(100);
      for (const p of s.players) {
        expect(p.cash).toBeGreaterThanOrEqual(0);
        expect(p.votes.reduce((a, b) => a + b, 0)).toBe(p.cash);
        expect(plotsOf(s, p.id).length).toBeLessThanOrEqual(3);
      }
    }
    expect(s.over, `turns ${turns}, ${JSON.stringify(s.players)}`).toBe(true);
    expect(s.players.every((p) => p.phase === "done" && p.laps === 2)).toBe(true);
  });
});
