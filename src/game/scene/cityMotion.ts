import { TABLE_IN, pentLoop } from "./layout";

/** Cosmetic movement only: never writes game state or changes turn timing. */
export const CITY_MOTION = {
  growthSeconds: 1.1,
  celebrationSeconds: 2.2,
  trafficSpeed: 0.65,
  /** Inradius of the pentagon ring road just inside the board frame, outside every arm. */
  roadIn: TABLE_IN - 0.6,
};

export function growthScale(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return Math.max(0.01, 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2);
}

/** Pentagon route; heading follows the car's local +Z and eases round each corner. */
export function trafficPose(distance: number, inr = CITY_MOTION.roadIn) {
  const p = pentLoop(inr, distance);
  // Blend into the next side's heading over the last 0.4 units so cars turn instead of snapping.
  const blend = 0.4 / p.sideLen;
  let heading = p.heading;
  if (p.t > 1 - blend) {
    const next = pentLoop(inr, distance + blend * p.sideLen).heading;
    let dh = next - heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    heading += dh * ((p.t - (1 - blend)) / blend) * 0.5;
  } else if (p.t < blend) {
    const prev = pentLoop(inr, distance - blend * p.sideLen).heading;
    let dh = prev - heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    heading += dh * (1 - p.t / blend) * 0.5;
  }
  return { x: p.x, z: p.z, heading, perimeter: p.perimeter };
}
