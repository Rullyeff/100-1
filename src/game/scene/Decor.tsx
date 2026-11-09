import { useEffect, useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { TABLE_HALF, TABLE_IN, gapSpot, pentCorner } from "./layout";
import { pentSlab, pentSheet } from "./pentGeometry";
import { boardArtTexture, deckTexture, marbleTexture, surfaceNormal } from "./textures";
import { coinMaterials } from "./coins";
import { AREA_COUNT } from "../sim/board";

/** Card decks resting in the open wedges between arms, coloured like the printed board. */
const DECKS = [
  { gap: 0, color: "#f08a24" },
  { gap: 1, color: "#2f7fe0" },
  { gap: 2, color: "#25a862" },
  { gap: 3, color: "#8a4fd0" },
];

export function Table({ lite = false }: { lite?: boolean }) {
  const tex = useMemo(() => {
    const marble = marbleTexture();
    marble.repeat.set(5, 5);
    return { marble, art: boardArtTexture(), paper: surfaceNormal("paper", 6) };
  }, []);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);
  const mats = useMemo(
    () => ({
      lacquer: new THREE.MeshPhysicalMaterial({ color: "#18214a", roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 }),
      gold: new THREE.MeshPhysicalMaterial({ color: "#e0b555", roughness: 0.18, metalness: 1, clearcoat: 0.8, clearcoatRoughness: 0.05, anisotropy: 0.6 }),
    }),
    [],
  );
  const geo = useMemo(() => {
    const rim = 0.16;
    return {
      frame: pentSlab(TABLE_IN, 0.6, -0.6),
      plinth: pentSlab(TABLE_IN + 0.15, 0.1, -0.6),
      rim: pentSlab(TABLE_IN, 0.08, -0.02, TABLE_IN - rim),
      // The printed sheet keeps the square art's world mapping, so every tile still sits on its printed spot.
      sheet: pentSheet(TABLE_IN - rim, TABLE_HALF - rim),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  return (
    <group>
      {/* Polished black marble table with live reflections */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
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
      {/* Navy lacquer pentagon frame on a gold plinth, gold rim along the top edge */}
      <mesh geometry={geo.frame} material={mats.lacquer} receiveShadow castShadow />
      <mesh geometry={geo.plinth} material={mats.gold} receiveShadow />
      <mesh geometry={geo.rim} material={mats.gold} castShadow />
      {/* Printed paper board, cut to the pentagon */}
      <mesh geometry={geo.sheet} position={[0, 0.005, 0]} receiveShadow>
        <meshPhysicalMaterial map={tex.art} color="#c4c8d2" normalMap={tex.paper} normalScale={[0.08, 0.08]} roughness={0.85} envMapIntensity={0.35} />
      </mesh>
      {DECKS.map((d) => <CardDeck key={d.gap} gap={d.gap} color={d.color} />)}
      {!lite && <TokenStacks />}
    </group>
  );
}

function CardDeck({ gap, color }: { gap: number; color: string }) {
  const [x, z] = gapSpot(gap, 6.6);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f4ecd8", roughness: 0.8 }), []);
  const top = useMemo(() => {
    const face = new THREE.MeshStandardMaterial({ map: deckTexture(color), color: "#cfc6b6", roughness: 0.6 });
    return [edge, edge, face, edge, edge, edge];
  }, [color, edge]);
  return (
    <group position={[x, 0.02, z]}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} material={i === 5 ? top : edge} position={[(i % 2) * 0.02, 0.03 + i * 0.035, (i % 3) * 0.015]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 0.03, 3.5]} />
        </mesh>
      ))}
    </group>
  );
}

/** Stacks of gold vote tokens and ballot boxes on the table around the board. */
function TokenStacks() {
  const box = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f2f2ee", roughness: 0.5 }), []);
  const slot = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1b1b1f", roughness: 0.6 }), []);
  const band = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c8382e", roughness: 0.5 }), []);
  // Beside the table off the four back/side flats (the front flat faces the camera and stays clear).
  const off = TABLE_IN + 3.1;
  const spots: [number, number, number][] = [0, 1, 3, 4].map((k, i) => {
    const [ax, az] = pentCorner(1, k);
    const [bx, bz] = pentCorner(1, k + 1);
    const len = Math.hypot(ax + bx, az + bz);
    return [((ax + bx) / len) * off, ((az + bz) / len) * off, [0.3, -0.4, 0.2, -0.2][i]!];
  });
  return (
    <>
      {spots.map(([x, z, r], si) => (
        <group key={si} position={[x, -0.6, z]} rotation-y={r}>
          <group position={[0.4, 0, 0]}>
            <mesh material={box} position={[0, 0.45, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.1, 0.9, 1.1]} />
            </mesh>
            <mesh material={band} position={[0, 0.62, 0]}>
              <boxGeometry args={[1.12, 0.16, 1.12]} />
            </mesh>
            <mesh material={slot} position={[0, 0.905, 0]}>
              <boxGeometry args={[0.55, 0.02, 0.08]} />
            </mesh>
          </group>
          {[0, 1, 2, 3].map((k) => {
            // Each stack holds one area's vote coins; alternate stacks show the logo side up.
            const mats = coinMaterials((si * 4 + k) % AREA_COUNT);
            return (
              <group key={`c${k}`} position={[-1.2 + (k % 2) * 0.48, 0, -0.3 + Math.floor(k / 2) * 0.55]}>
                {Array.from({ length: 4 + ((k + si) % 4) * 2 }, (_, j) => (
                  <mesh key={j} material={(k + si) % 2 ? mats.backUp : mats.faceUp} position={[(j % 2) * 0.02, 0.03 + j * 0.06, 0]} castShadow>
                    <cylinderGeometry args={[0.2, 0.2, 0.055, 28]} />
                  </mesh>
                ))}
              </group>
            );
          })}
          {/* A loose pair lying beside the stacks: icon face and logo back. */}
          {[0, 1].map((j) => (
            <mesh key={`l${j}`} material={j ? coinMaterials(si % AREA_COUNT).backUp : coinMaterials(si % AREA_COUNT).faceUp} position={[-1.95 + j * 0.44, 0.03, 0.35]} rotation-y={j * 0.6} castShadow>
              <cylinderGeometry args={[0.2, 0.2, 0.055, 28]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
