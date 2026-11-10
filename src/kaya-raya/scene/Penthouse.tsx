import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ambience } from "./timeOfDay";
import * as THREE from "three";

/** Night skyline painted once onto a canvas; wraps a huge cylinder around the table. */
function skylineTexture(): THREE.CanvasTexture {
  const W = 2048, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#05060c");
  sky.addColorStop(0.6, "#141a2e");
  sky.addColorStop(1, "#3a2a2a");
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let layer = 0; layer < 2; layer++) {
    let x = 0;
    while (x < W) {
      const w = 30 + rnd() * 70;
      const h = (layer ? 120 : 60) + rnd() * (layer ? 260 : 160);
      g.fillStyle = layer ? "#07080d" : "#0d1020";
      g.fillRect(x, H - h, w, h);
      for (let wy = H - h + 8; wy < H - 6; wy += 10)
        for (let wx = x + 4; wx < x + w - 4; wx += 8)
          if (rnd() < (layer ? 0.32 : 0.2)) {
            g.fillStyle = rnd() < 0.8 ? "rgba(255,206,130,0.9)" : "rgba(170,210,255,0.8)";
            g.fillRect(wx, wy, 3, 4);
          }
      x += w + rnd() * 6;
    }
  }
  // Out-of-focus street lights far below: soft bokeh discs along the horizon.
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = H * (0.72 + rnd() * 0.26), r = 6 + rnd() * 16;
    const warm = rnd() < 0.7;
    const b = g.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, warm ? "rgba(255,190,110,0.35)" : "rgba(150,195,255,0.3)");
    b.addColorStop(0.7, warm ? "rgba(255,170,90,0.18)" : "rgba(130,180,255,0.15)");
    b.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = b;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = "source-over";
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

/** Penthouse lounge: panoramic night windows, mullions and warm ceiling pendants. */
export function Penthouse() {
  const tex = useMemo(() => skylineTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  const mullions = useMemo(() => Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2), []);
  const sky = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => { sky.current?.color.setRGB(ambience.sky[0]!, ambience.sky[1]!, ambience.sky[2]!); });
  return (
    <group>
      <mesh position={[0, 14, 0]}>
        <cylinderGeometry args={[70, 70, 50, 48, 1, true]} />
        <meshBasicMaterial ref={sky} map={tex} side={THREE.BackSide} toneMapped={false} fog={false} />
      </mesh>
      {mullions.map((a) => (
        <mesh key={a} position={[Math.cos(a) * 68, 14, Math.sin(a) * 68]} rotation-y={-a}>
          <boxGeometry args={[0.6, 50, 0.6]} />
          <meshStandardMaterial color="#0b0a0c" roughness={0.6} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 18, 22, -10]}>
          <sphereGeometry args={[0.8, 16, 12]} />
          <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
