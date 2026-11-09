// Transient visual impulses shared by the controller and the 3D scene (no React state, read per frame).
export const fx = {
  /** Camera shake strength in world units; decays every frame. */
  shake: 0,
  /** Throw strength 0..1 of the current dice roll. */
  power: 0.6,
  /** Critical-rent snap zoom 0..1 toward (punchX, punchZ); decays every frame. */
  punch: 0,
  punchX: 0,
  punchZ: 0,
  /** Pawn-tracking strength 0..1 toward the moving pawn at (trackX, trackZ); pawns refresh it while hopping. */
  track: 0,
  trackX: 0,
  trackZ: 0,
};

export function kick(amount: number) {
  fx.shake = Math.max(fx.shake, amount);
}
