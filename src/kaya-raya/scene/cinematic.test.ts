import { describe, expect, it } from "vitest";
import { createGame } from "../sim/state";
import { milestone, useCinematic } from "./cinematic";

describe("milestone cinematics", () => {
  it("lets the player dismiss the cinematic immediately", () => {
    useCinematic.getState().show({ id: 1, title: "LANDMARK!", text: "", tiles: [10] });
    expect(useCinematic.getState().event?.id).toBe(1);
    useCinematic.getState().skip();
    expect(useCinematic.getState().event).toBeNull();
  });
  it("focuses one captured city", () => {
    const game = createGame(1);
    const player = game.players[0];
    if (!player) throw new Error("Missing player");
    player.pos = 10;
    expect(milestone("AMBIL ALIH!", 0, game)).toEqual([10]);
  });
  it("focuses a newly purchased property", () => {
    const game = createGame(1);
    const player = game.players[0];
    if (!player) throw new Error("Missing player");
    player.pos = 9;
    expect(milestone("KOTA BARU!", 0, game)).toEqual([9]);
  });

  it("focuses the full completed colour group", () => {
    const game = createGame(1);
    const player = game.players[0];
    if (!player) throw new Error("Missing player");
    player.pos = 10;
    expect(milestone("MONOPOLI WARNA!", 0, game)).toEqual([9, 10]);
  });

  it("does not create cinematics for ordinary banners", () => {
    const game = createGame(1);
    const player = game.players[0];
    if (!player) throw new Error("Missing player");
    player.pos = 10;
    expect(milestone("BONUS", 0, game)).toBeNull();
  });
});
