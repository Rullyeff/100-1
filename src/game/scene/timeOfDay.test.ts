import { describe, expect, it } from "vitest";
import { phaseForRound } from "./timeOfDay";

describe("day/night cycle", () => {
  it("starts in daytime", () => expect(phaseForRound(1)).toBe("day"));
  it("turns to dusk on round 3", () => expect(phaseForRound(3)).toBe("dusk"));
  it("turns to night on round 5", () => expect(phaseForRound(5)).toBe("night"));
  it("loops back to day on round 7", () => expect(phaseForRound(7)).toBe("day"));
});
