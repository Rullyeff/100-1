/** Cosmetic movement only: never writes game state or changes turn timing. */
export const CITY_MOTION = {
  growthSeconds: 1.1,
  celebrationSeconds: 2.2,
  trafficSpeed: 0.65,
  roadHalf: 4.82,
};

export function growthScale(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return Math.max(0.01, 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2);
}

/** Rounded-square route, tangent heading follows the car's local +Z. */
export function trafficPose(distance: number, half = CITY_MOTION.roadHalf) {
  const radius = 0.55;
  const straight = 2 * (half - radius);
  const arc = Math.PI * radius / 2;
  const section = straight + arc;
  const perimeter = 4 * section;
  const d = ((distance % perimeter) + perimeter) % perimeter;
  const side = Math.floor(d / section);
  const local = d - side * section;
  let x: number, z: number, heading: number;
  if (local <= straight) {
    x = -half + radius + local;
    z = half;
    heading = Math.PI / 2;
  } else {
    const angle = (local - straight) / radius;
    x = half - radius + radius * Math.sin(angle);
    z = half - radius + radius * Math.cos(angle);
    heading = Math.PI / 2 + angle;
  }
  const rotation = side * Math.PI / 2;
  return {
    x: x * Math.cos(rotation) + z * Math.sin(rotation),
    z: -x * Math.sin(rotation) + z * Math.cos(rotation),
    heading: heading + rotation,
    perimeter,
  };
}