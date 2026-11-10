import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import houseUrl from "@/assets/models/city-house.glb?url";
const house = { url: houseUrl };
import officeUrl from "@/assets/models/city-office.glb?url";
const office = { url: officeUrl };
import hotelUrl from "@/assets/models/city-hotel.glb?url";
const hotel = { url: hotelUrl };
import towerUrl from "@/assets/models/city-tower.glb?url";
const tower = { url: towerUrl };
import { TILE_H } from "./layout";
import { CityModel } from "./CityModel";
import { cityColor } from "./cityPalette";
import { CITY_MOTION, growthScale } from "./cityMotion";
import { kick } from "../fx";
import { sfx } from "../audio";
import { ambience } from "./timeOfDay";

const DROP_SECONDS = 0.45;
const DROP_HEIGHT = 3.2;
import { useReducedMotion } from "./useReducedMotion";
import { useLiteQuality } from "./quality";

for (const asset of [house, office, hotel, tower]) useGLTF.preload(asset.url);
const baseY = TILE_H / 2 + 0.024;
const box = new THREE.BoxGeometry(1, 1, 1);

/** Owner and level are read-only: construction never changes the game rules. */
export function Buildings({ owner, level }: { owner: number; level: number }) {
  const reduced = useReducedMotion();
  const lite = useLiteQuality();
  const color = useMemo(() => cityColor(`player-${owner + 1}`), [owner]);
  const palette = useMemo(() => ({ gold: cityColor("gold"), glass: cityColor("glass"), light: cityColor("light") }), []);
  const previous = useRef(-1);
  const elapsed = useRef(0);
  const building = useRef<THREE.Group>(null);
  const crown = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const flag = useRef<THREE.Mesh>(null);
  const active = useRef(false);
  const slammed = useRef(false);
  useEffect(() => {
    active.current = level > previous.current && level > 0 && !reduced;
    elapsed.current = 0;
    slammed.current = false;
    if (active.current && level >= 4) setTimeout(() => sfx.confetti(), 450);
    previous.current = level;
  }, [level, reduced]);

  const glass = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }, delta) => {
    if (glass.current) glass.current.emissiveIntensity = 0.12 + ambience.night * 1.4;
    if (flag.current && !reduced && !lite) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2.4) * 0.2;
    if (!building.current) return;
    if (!active.current) {
      if (building.current.scale.y !== 1) building.current.scale.setScalar(1);
      if (building.current.position.y !== 0.07) building.current.position.y = 0.07;
      if (crown.current && crown.current.scale.x !== 1) { crown.current.scale.setScalar(1); crown.current.rotation.y = 0; }
      if (ring.current?.visible) ring.current.visible = false;
      return;
    }
    const isBuilding = active.current;
    elapsed.current += Math.min(delta, 0.05);
    const t = elapsed.current;
    // Drop from the sky, slam with a squash, then settle.
    const fall = Math.min(1, t / DROP_SECONDS);
    building.current.position.y = 0.07 + (1 - fall * fall) * DROP_HEIGHT;
    const after = t - DROP_SECONDS;
    if (after >= 0 && !slammed.current) { slammed.current = true; kick(level >= 4 ? 0.35 : 0.18); if (level >= 4) sfx.landmark(); else sfx.thud(); }
    const squash = after >= 0 ? Math.exp(-7 * after) * Math.cos(after * 22) * 0.28 : 0;
    building.current.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    if (crown.current) {
      const scale = isBuilding ? growthScale((t - 0.45) / 0.8) : 1;
      crown.current.scale.setScalar(scale);
      crown.current.rotation.y = isBuilding ? (1 - Math.min(1, t / 1.5)) * Math.PI * 2 : 0;
    }
    if (ring.current && ringMaterial.current) {
      ring.current.visible = isBuilding && t < CITY_MOTION.celebrationSeconds;
      ring.current.scale.setScalar(0.5 + t * 0.7);
      ringMaterial.current.opacity = Math.max(0, 0.65 * (1 - t / CITY_MOTION.celebrationSeconds));
    }
    if (t >= CITY_MOTION.celebrationSeconds) active.current = false;
  });

  const asset = level === 1 ? house : level === 2 ? office : level === 3 ? hotel : tower;
  const height = level === 1 ? 0.62 : level === 2 ? 1.05 : level === 3 ? 1.45 : 1.85;
  return (
    <group position={[0, baseY, -0.62]} name={`city-level-${level}`}>
      <group position={[0.53, 0, 0.31]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.6, 6]} />
          <meshStandardMaterial color={palette.gold} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh ref={flag} position={[0.1, 0.51, 0]}>
          <boxGeometry args={[0.2, 0.13, 0.018]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      {level > 0 && <>
        <mesh geometry={box} position={[0, 0.035, 0]} scale={[1.1, 0.07, 0.82]} receiveShadow>
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        <group ref={building} position={[0, 0.07, 0]}>
          <Suspense fallback={null}>
            <CityModel url={asset.url} width={level === 1 ? 0.88 : 0.8} depth={0.67} height={height} />
          </Suspense>
          {level >= 2 && <mesh geometry={box} position={[0, height * 0.54, 0.342]} scale={[0.53, height * 0.48, 0.018]}>
            <meshStandardMaterial ref={glass} color={palette.glass} emissive={palette.light} emissiveIntensity={0.16} metalness={0.35} roughness={0.2} />
          </mesh>}
          {level >= 3 && <mesh geometry={box} position={[0, height - 0.08, 0]} scale={[0.9, 0.07, 0.73]}>
            <meshStandardMaterial color={color} metalness={0.35} roughness={0.3} />
          </mesh>}
          {level >= 4 && <group ref={crown} position={[0, height, 0]}>
            <mesh rotation-y={Math.PI / 4} castShadow>
              <octahedronGeometry args={[0.28, 0]} />
              <meshStandardMaterial color={palette.gold} metalness={0.75} roughness={0.2} emissive={palette.light} emissiveIntensity={0.25} />
            </mesh>
            <mesh position={[0, -0.02, 0]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.35, 0.025, 6, 24]} />
              <meshStandardMaterial color={palette.gold} metalness={0.65} roughness={0.3} />
            </mesh>
          </group>}
        </group>
        <mesh ref={ring} position={[0, 0.09, 0]} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.4, 0.44, 32]} />
          <meshBasicMaterial ref={ringMaterial} color={palette.light} transparent depthWrite={false} opacity={0} />
        </mesh>
      </>}
    </group>
  );
}