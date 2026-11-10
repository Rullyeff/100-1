import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import taxi from "@/assets/models/city-taxi.glb.asset.json";
import sedan from "@/assets/models/city-sedan.glb.asset.json";
import { CityModel } from "./CityModel";
import { cityColor } from "./cityPalette";
import { CITY_MOTION, trafficPose } from "./cityMotion";
import { useReducedMotion } from "./useReducedMotion";
import { useLiteQuality } from "./quality";
import { ambience } from "./timeOfDay";

const lampGeo = new THREE.SphereGeometry(0.022, 8, 6);
const headMat = new THREE.MeshBasicMaterial({ color: "#fff3c8", transparent: true, toneMapped: false });
const tailMat = new THREE.MeshBasicMaterial({ color: "#ff2a1a", transparent: true, toneMapped: false });
const beamGeo = new THREE.CircleGeometry(0.16, 16);
const beamMat = new THREE.MeshBasicMaterial({ color: "#ffe9b0", transparent: true, depthWrite: false, toneMapped: false });

useGLTF.preload(taxi.url);
useGLTF.preload(sedan.url);

function roadTexture(road: string, marking: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = road;
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = marking;
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 1500; i++) {
      ctx.fillRect((i * 73) % 256, (i * 31) % 64, 1, 1);
    }
    ctx.globalAlpha = 0.8;
    ctx.fillRect(18, 30, 34, 3);
    ctx.fillRect(82, 30, 34, 3);
    ctx.fillRect(146, 30, 34, 3);
    ctx.fillRect(210, 30, 34, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
}

export function Traffic() {
  const reduced = useReducedMotion();
  const lite = useLiteQuality();
  const count = lite ? 3 : 6;
  const vehicles = useRef<Array<THREE.Group | null>>([]);
  const distance = useRef(0);
  const stationary = useRef(false);
  const palette = useMemo(() => ({ road: cityColor("road"), curb: cityColor("curb"), marking: cityColor("marking") }), []);
  const texture = useMemo(() => roadTexture(palette.road, palette.marking), [palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  const perimeter = trafficPose(0).perimeter;
  useFrame((_, delta) => {
    const n = ambience.night;
    headMat.opacity = 0.15 + n * 0.85; tailMat.opacity = 0.2 + n * 0.8; beamMat.opacity = n * 0.22;
    if (reduced && stationary.current) return;
    stationary.current = reduced;
    if (!reduced) distance.current += Math.min(delta, 0.05) * CITY_MOTION.trafficSpeed;
    vehicles.current.forEach((vehicle, index) => {
      if (!vehicle) return;
      const pose = trafficPose(distance.current + index * perimeter / count);
      vehicle.position.set(pose.x, 0.055, pose.z);
      vehicle.rotation.y = pose.heading;
    });
  });
  return <group name="living-city-traffic">
    {[0, 1, 2, 3].map((side) => <group key={side} rotation-y={side * Math.PI / 2}>
      <mesh position={[0, 0.028, CITY_MOTION.roadHalf]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[CITY_MOTION.roadHalf * 2 + 0.38, 0.4]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.038, CITY_MOTION.roadHalf - 0.24]} receiveShadow>
        <boxGeometry args={[CITY_MOTION.roadHalf * 2 - 0.2, 0.07, 0.08]} />
        <meshStandardMaterial color={palette.curb} roughness={0.7} />
      </mesh>
    </group>)}
    <Suspense fallback={null}>
      {Array.from({ length: count }, (_, index) => <group key={index} ref={(node) => { vehicles.current[index] = node; }} name={`city-car-${index}`}>
        <CityModel url={index % 2 === 0 ? taxi.url : sedan.url} width={0.18} depth={0.36} height={0.16} />
        {[-0.06, 0.06].map((x) => <group key={x}>
          <mesh geometry={lampGeo} material={headMat} position={[x, 0.07, 0.18]} />
          <mesh geometry={lampGeo} material={tailMat} position={[x, 0.07, -0.18]} scale={0.8} />
        </group>)}
        <mesh geometry={beamGeo} material={beamMat} position={[0, 0.012, 0.36]} rotation-x={-Math.PI / 2} scale={[0.8, 1.4, 1]} />
      </group>)}
    </Suspense>
  </group>;
}