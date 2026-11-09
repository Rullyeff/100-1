// Pure camera-direction rules: which cinematic shot plays, and when a build earns a showcase.
// Presentation only — nothing here touches simulation state or turn pacing.

/** Seconds the low-angle tilt-up lingers on a new hotel or landmark. */
export const SHOWCASE_SECONDS = 2;
/** Building level that earns a showcase: 3 = hotel, 4 = landmark. */
export const SHOWCASE_MIN_LEVEL = 3;

/** Seconds the camera holds a low close-up on the settled dice after every throw; ends just before the piece starts walking. */
export const DICE_CLOSEUP_SECONDS = 1.2;

export type ShotKind = "showcase" | "milestone" | "punch" | "closeup" | "dice" | "track" | "idle";

export interface ShotInputs {
  showcase: boolean;
  milestone: boolean;
  punch: number;
  /** The player's dice just settled and the close-up is still running. */
  closeup?: boolean;
  rolling: boolean;
  track: number;
}

/** Highest-priority shot wins: building showcase > milestone banner > rent punch > dice close-up > dice throw > pawn tracking. */
export function pickShot(i: ShotInputs): ShotKind {
  if (i.showcase) return "showcase";
  if (i.milestone) return "milestone";
  if (i.punch > 0.05) return "punch";
  if (i.closeup) return "closeup";
  if (i.rolling) return "dice";
  if (i.track > 0.05) return "track";
  return "idle";
}

/** A close-up starts whenever the dice stop rolling, for every player, so each result is seen before the piece moves. */
export function startsDiceCloseup(wasRolling: boolean, rolling: boolean): boolean {
  return wasRolling && !rolling;
}

/** Returns the tile that just became a hotel or landmark (highest new level wins), or null. */
export function showcaseTile(prev: readonly number[], next: readonly number[]): number | null {
  if (prev.length !== next.length) return null;
  let best: number | null = null;
  for (let i = 0; i < next.length; i++) {
    const lv = next[i]!;
    if (lv >= SHOWCASE_MIN_LEVEL && lv > prev[i]! && (best === null || lv > next[best]!)) best = i;
  }
  return best;
}
