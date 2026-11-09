import { describe, expect, it } from "vitest";
import { DICE_CLOSEUP_SECONDS, pickShot, showcaseTile, startsDiceCloseup } from "./director";
import { DICE_RESULT_HOLD_MS } from "../store";

const none = { showcase: false, milestone: false, punch: 0, rolling: false, track: 0 };

describe("camera director", () => {
  it("zooms toward the dice while they roll", () => {
    expect(pickShot({ ...none, rolling: true })).toBe("dice");
  });

  it("follows a moving pawn", () => {
    expect(pickShot({ ...none, track: 1 })).toBe("track");
  });

  it("a hotel or landmark showcase overrides every other shot", () => {
    expect(pickShot({ showcase: true, milestone: true, punch: 1, rolling: true, track: 1 })).toBe("showcase");
  });

  it("returns to the full-board view when nothing is happening", () => {
    expect(pickShot(none)).toBe("idle");
  });

  it("building a hotel (level 3) triggers a showcase", () => {
    expect(showcaseTile([0, 2, 0], [0, 3, 0])).toBe(1);
  });

  it("building a landmark (level 4) triggers a showcase", () => {
    expect(showcaseTile([0, 0, 3], [0, 0, 4])).toBe(2);
  });

  it("houses and villas do not trigger a showcase", () => {
    expect(showcaseTile([0, 0], [1, 2])).toBeNull();
  });

  it("every throw gets a dice close-up once the dice settle", () => {
    expect(startsDiceCloseup(true, false)).toBe(true);
  });

  it("no close-up while the dice are still rolling", () => {
    expect(startsDiceCloseup(true, true)).toBe(false);
  });

  it("the dice close-up ends before the piece starts walking", () => {
    expect(DICE_CLOSEUP_SECONDS * 1000).toBeLessThan(DICE_RESULT_HOLD_MS);
  });

  it("the dice close-up outranks pawn tracking but not a hotel showcase", () => {
    expect(pickShot({ ...none, closeup: true, track: 1 })).toBe("closeup");
    expect(pickShot({ ...none, closeup: true, showcase: true })).toBe("showcase");
  });

  it("starting a new game (levels reset) does not trigger a showcase", () => {
    expect(showcaseTile([3, 4], [0, 0])).toBeNull();
  });
});
