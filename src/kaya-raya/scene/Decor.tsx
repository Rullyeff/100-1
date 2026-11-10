import { useEffect, useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { ISLAND_INDEX, TRAVEL_INDEX, WORLDCUP_INDEX } from "../sim/board";
import { BOARD_LEN, CORNER, HALF, TILE_D, TILE_H, tileXform } from "./layout";
import { billTexture, feltTexture, marbleTexture, surfaceNormal } from "./textures";

const TOP = TILE_H + 0.02;

export function Table({ lite = false }: { lite?: boolean }) {
  const tex = useMemo(() => {
    const marble = marbleTexture();
    marble.repeat.set(5, 5);
    return { marble, felt: feltTexture("KAYA RAYA"), weave: surfaceNormal("weave", 18) };
  }, []);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);
  const mats = useMemo(
    () => ({
      lacquer: new THREE.MeshPhysicalMaterial({ color: "#141012", roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 }),
      gold: new THREE.MeshPhysicalMaterial({ color: "#e0b555", roughness: 0.18, metalness: 1, clearcoat: 0.8, clearcoatRoughness: 0.05, anisotropy: 0.6 }),
    }),
    [],
  );
  const inner = BOARD_LEN - TILE_D * 2;
  const F = BOARD_LEN + 0.9;
  const rim = 0.16;

  return (
    <group>
      {/* Polished black marble table with live reflections */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        {lite ? <meshStandardMaterial map={tex.marble} roughness={0.45} metalness={0.1} color="#6a6560" /> : <MeshReflectorMaterial
          map={tex.marble}
          resolution={512}
          blur={[400, 120]}
          mixBlur={1}
          mixStrength={1.1}
          mirror={0.5}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          roughness={0.4}
          metalness={0.15}
          color="#4c4844"
        />}
      </mesh>
      {/* Black lacquer frame on a gold plinth, gold rim along the top edge */}
      <mesh material={mats.lacquer} position={[0, -0.3, 0]} receiveShadow castShadow>
        <boxGeometry args={[F, 0.6, F]} />
      </mesh>
      <mesh material={mats.gold} position={[0, -0.55, 0]} receiveShadow>
        <boxGeometry args={[F + 0.3, 0.1, F + 0.3]} />
      </mesh>
      {[0, 1, 2, 3].map((k) => {
        const along = k % 2 === 0;
        const sgn = k < 2 ? 1 : -1;
        const o = F / 2 - rim / 2;
        return (
          <mesh
            key={k}
            material={mats.gold}
            position={along ? [0, 0.02, sgn * o] : [sgn * o, 0.02, 0]}
            castShadow
          >
            <boxGeometry args={along ? [F + 0.02, 0.08, rim] : [rim, 0.08, F + 0.02]} />
          </mesh>
        );
      })}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[inner, inner]} />
        {/* Casino cloth: woven normal map plus a soft fabric sheen */}
        <meshPhysicalMaterial map={tex.felt} normalMap={tex.weave} normalScale={[0.55, 0.55]} roughness={0.95} sheen={1} sheenRoughness={0.75} sheenColor="#4f9c80" envMapIntensity={0.5} />
      </mesh>
      {!lite && <MoneyStacks />}
      <PalmTree />
      <Trophy />
      <Plane />
    </group>
  );
}

function cornerPos(i: number): [number, number] {
  const t = tileXform(i);
  return [t.x, t.z];
}

function PalmTree() {
  const [x, z] = cornerPos(ISLAND_INDEX);
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3f9a3a", roughness: 0.6, side: THREE.DoubleSide }), []);
  return (
    <group position={[x - 0.45, TOP, z - 0.45]}>
      <mesh position={[0, 0.7, 0]} rotation-z={0.12} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 1.4, 8]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh
          key={k}
          material={leaf}
          position={[0.08, 1.42, 0]}
          rotation={[0, (k / 5) * Math.PI * 2, 0.9]}
          castShadow
        >
          <coneGeometry args={[0.12, 0.9, 4]} />
        </mesh>
      ))}
      <mesh position={[0.25, 0.08, 0.3]} castShadow>
        <sphereGeometry args={[0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e8cf8f" roughness={1} />
      </mesh>
    </group>
  );
}

function Trophy() {
  const [x, z] = cornerPos(WORLDCUP_INDEX);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffc93c", metalness: 0.85, roughness: 0.25 }), []);
  return (
    <group position={[x - 0.4, TOP, z - 0.4]}>
      <mesh material={gold} position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.36, 0.2, 20]} />
      </mesh>
      <mesh material={gold} position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 0.5, 12]} />
      </mesh>
      <mesh material={gold} position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.12, 0.55, 20, 1, true]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={gold} position={[s * 0.4, 0.95, 0]} rotation-y={s > 0 ? 0 : Math.PI}>
          <torusGeometry args={[0.13, 0.03, 8, 16, Math.PI]} />
        </mesh>
      ))}
    </group>
  );
}

function Plane() {
  const [x, z] = cornerPos(TRAVEL_INDEX);
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f4f7fb", roughness: 0.35 }), []);
  const blue = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2f7fe0", roughness: 0.35 }), []);
  return (
    <group position={[x + 0.2, TOP + 1.1, z - 0.5]} rotation={[0.15, Math.PI / 4, -0.15]}>
      <mesh material={white} rotation-z={Math.PI / 2} castShadow>
        <capsuleGeometry args={[0.16, 1.1, 6, 12]} />
      </mesh>
      <mesh material={blue} position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 0.04, 1.5]} />
      </mesh>
      <mesh material={blue} position={[-0.62, 0.2, 0]} castShadow>
        <boxGeometry args={[0.2, 0.3, 0.04]} />
      </mesh>
      <mesh material={blue} position={[-0.62, 0.05, 0]} castShadow>
        <boxGeometry args={[0.18, 0.03, 0.6]} />
      </mesh>
    </group>
  );
}

function MoneyStacks() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: billTexture(), roughness: 0.8 }), []);
  const band = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2f5f9e", roughness: 0.6 }), []);
  const coin = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f0c45a", metalness: 1, roughness: 0.25 }), []);
  useEffect(() => () => (mat.map?.dispose(), mat.dispose()), [mat]);
  const off = HALF + 2.6;
  const spots: [number, number, number][] = [
    [-off, -off * 0.35, 0.3],
    [off * 0.35, -off, -0.4],
    [off, off * 0.4, 0.2],
    [-off * 0.4, off, -0.2],
  ];
  return (
    <>
      {spots.map(([x, z, r], si) => (
        <group key={si} position={[x, -0.6, z]} rotation-y={r}>
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const col = k % 3;
            const row = Math.floor(k / 3);
            const h = 0.35 + ((k * 7 + si * 3) % 4) * 0.18;
            return (
              <group key={k} position={[(col - 1) * 1.15, h / 2, (row - 0.5) * 0.65]}>
                <mesh material={mat} castShadow receiveShadow>
                  <boxGeometry args={[1.05, h, 0.55]} />
                </mesh>
                <mesh material={band} position={[0, 0, 0]}>
                  <boxGeometry args={[0.18, h + 0.01, 0.56]} />
                </mesh>
              </group>
            );
          })}
          {[0, 1, 2].map((k) => (
            <group key={`c${k}`} position={[-1.4 + k * 0.45, 0, 0.95 + (k % 2) * 0.2]}>
              {Array.from({ length: 3 + ((k + si) % 4) * 2 }, (_, j) => (
                <mesh key={j} material={coin} position={[(j % 2) * 0.02, 0.03 + j * 0.06, 0]} castShadow>
                  <cylinderGeometry args={[0.2, 0.2, 0.055, 20]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

export const CORNER_SIZE = CORNER;
