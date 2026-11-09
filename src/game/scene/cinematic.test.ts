import { describe, expect, it } from "vitest";
import { homeId, pentId } from "../sim/board";
import { createGame } from "../sim/state";
import { milestone, useCinematic } from "./cinematic";

describe("milestone cinematics", () => {
  it("lets the player dismiss the cinematic immediately", () => {
    useCinematic.getState().show({ id: 1, title: "AMBIL ALIH!", text: "", tiles: [10] });
    expect(useCinematic.getState().event?.id).toBe(1);
    useCinematic.getState().skip();
    expect(useCinematic.getState().event).toBeNull();
  });
  it("focuses a captured plot", () => {
    const game = createGame(1);
    game.players[0]!.pos = pentId(6);
    expect(milestone("AMBIL ALIH!", 0, game)).toEqual([pentId(6)]);
  });
  it("focuses a newly claimed plot", () => {
    const game = createGame(1);
    game.players[0]!.pos = pentId(2);
    expect(milestone("WILAYAH BARU!", 0, game)).toEqual([pentId(2)]);
  });
  it("focuses a captured Gerbang Aman", () => {
    const game = createGame(1);
    game.players[0]!.pos = homeId(2);
    expect(milestone("GERBANG DIREBUT!", 0, game)).toEqual([homeId(2)]);
  });
  it("does not create cinematics for ordinary banners", () => {
    const game = createGame(1);
    game.players[0]!.pos = pentId(2);
    expect(milestone("GUGUR!", 0, game)).toBeNull();
  });
});
