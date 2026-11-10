import { describe, expect, it } from "vitest";
import { createGame, tollOf } from "./state";
import { eventForRound } from "./events";
import { land, playTurn, type Turn } from "./engine";

describe("temporary board events", () => {
  function drive(turn: Turn) {
    let result = turn.next();
    while (!result.done) result = turn.next(result.value.kind === "buy" ? -1 : undefined);
  }
  function city(kind: "flood" | "festival" | "boom") {
    const game = createGame(1);
    game.levels[9] = 1;
    game.boardEvent = { kind, group: 2, startsRound: 1, endsRound: 2 };
    return game;
  }
  it("flood halves Jakarta house rent from 96 to 48", () => { expect(tollOf(city("flood"), 9)).toBe(48); });
  it("festival increases Jakarta house rent from 96 to 144", () => { expect(tollOf(city("festival"), 9)).toBe(144); });
  it("boom doubles Jakarta house rent from 96 to 192", () => { expect(tollOf(city("boom"), 9)).toBe(192); });
  it("expires after two rounds", () => { const game = city("boom"); game.round = 3; expect(tollOf(game, 9)).toBe(96); });
  it("leaves other groups unaffected", () => { const game = city("boom"); game.levels[1] = 1; expect(tollOf(game, 1)).toBe(40); });
  it("combines with World Cup exactly once", () => { const game = city("festival"); game.festival = 9; expect(tollOf(game, 9)).toBe(288); });
  it("has a quiet third round and starts the next event in round four", () => {
    expect(eventForRound(3)).toBeNull();
    expect(eventForRound(4)).toEqual({ kind: "flood", group: 5, startsRound: 4, endsRound: 5 });
  });
  it("transfers the modified rent to the owner on a real landing", () => {
    const game = city("festival");
    const visitor = game.players[0];
    const owner = game.players[1];
    if (!visitor || !owner) throw new Error("Missing players");
    visitor.pos = 9; game.owners[9] = 1;
    drive(land(game, 0));
    expect(visitor.cash).toBe(1856);
    expect(owner.cash).toBe(2144);
  });
  it("clears the event at the round-three boundary", () => {
    const game = city("festival");
    const player = game.players[3];
    if (!player) throw new Error("Missing player");
    game.round = 2; game.turn = 3; player.travel = true;
    const turn = playTurn(game);
    let result = turn.next();
    while (!result.done) result = turn.next(result.value.kind === "pick" ? 0 : undefined);
    expect(game.round).toBe(3);
    expect(game.boardEvent).toBeNull();
  });
});