import { useMemo } from "react";
import type { BoardEventKind } from "../sim/events";
import { cityColor } from "./cityPalette";
import { TILE_H } from "./layout";

/** Static, single-pass tile outline: no extra lights, particles or frame callbacks. */
export function BoardEventMark({ kind }: { kind: BoardEventKind }) {
  const color = useMemo(() => cityColor(kind === "flood" ? "glass" : kind === "festival" ? "gold" : "park"), [kind]);
  return <group position={[0, TILE_H / 2 + 0.045, 0]} name={`event-${kind}`}>
    <mesh rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.45, 0.53, 4]} />
      <meshBasicMaterial color={color} />
    </mesh>
    {[-0.63, 0.63].map((x) => <mesh key={x} position={[x, 0, 0]}>
      <boxGeometry args={[0.035, 0.04, 2.18]} />
      <meshBasicMaterial color={color} />
    </mesh>)}
  </group>;
}