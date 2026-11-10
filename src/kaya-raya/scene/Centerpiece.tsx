import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { globeTexture } from "./textures";

/** Rotating earth globe on a gold pedestal in the middle of the board. */
const GLOBE_R = 1.25;
const GLOBE_Y = 2.35;
const SPIN = 0.18;

export function Centerpiece() {
  const tex = useMemo(() => globeTexture(), []);
  useEffect(() => () => (tex.map.dispose(), tex.glow.dispose()), [tex]);
  const gold = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#e6bb5c", metalness: 1, roughness: 0.18, clearcoat: 0.6 }),
    [],
  );
  const globe = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Group>(null);
  const ringB = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    if (globe.current) globe.current.rotation.y += SPIN * dt;
    if (ringA.current) ringA.current.rotation.z += 0.5 * dt;
    if (ringB.current) ringB.current.rotation.z -= 0.35 * dt;
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(t * 1.6) * 0.04;
  });

  return (
    <group>
      {/* Pedestal */}
      <mesh material={gold} position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.1, 0.2, 40]} />
      </mesh>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.85, 0.08, 40]} />
        <meshPhysicalMaterial color="#141012" roughness={0.2} clearcoat={1} />
      </mesh>
      <mesh material={gold} position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.22, 0.8, 16]} />
      </mesh>
      {/* Meridian arc holding the globe */}
      <mesh material={gold} position={[0, GLOBE_Y, 0]} rotation={[0, Math.PI / 4, 0.41]}>
        <torusGeometry args={[GLOBE_R + 0.12, 0.035, 10, 64, Math.PI * 1.2]} />
      </mesh>

      <group position={[0, GLOBE_Y, 0]} rotation-z={0.41}>
        <mesh ref={globe} castShadow>
          <sphereGeometry args={[GLOBE_R, 64, 40]} />
          <meshPhysicalMaterial
            map={tex.map}
            emissiveMap={tex.glow}
            emissive="#ffd27a"
            emissiveIntensity={1.4}
            roughness={0.35}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </mesh>
        {/* Soft atmosphere */}
        <mesh ref={halo} scale={1.1}>
          <sphereGeometry args={[GLOBE_R, 32, 20]} />
          <meshBasicMaterial color="#7cc8ff" transparent opacity={0.16} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      </group>

      {/* Orbit rings with little satellites */}
      <group position={[0, GLOBE_Y, 0]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
        <group ref={ringA}>
          <mesh material={gold}>
            <torusGeometry args={[GLOBE_R + 0.55, 0.025, 8, 96]} />
          </mesh>
          <mesh position={[GLOBE_R + 0.55, 0, 0]}>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshStandardMaterial color="#fff3c4" emissive="#ffcf5a" emissiveIntensity={2.5} />
          </mesh>
        </group>
      </group>
      <group position={[0, GLOBE_Y, 0]} rotation={[Math.PI / 2 + 0.55, 0.4, 0]}>
        <group ref={ringB}>
          <mesh material={gold}>
            <torusGeometry args={[GLOBE_R + 0.32, 0.018, 8, 96]} />
          </mesh>
          <mesh position={[-(GLOBE_R + 0.32), 0, 0]}>
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshStandardMaterial color="#d8f0ff" emissive="#7cc8ff" emissiveIntensity={2.5} />
          </mesh>
        </group>
      </group>
      <Sparkles count={40} scale={[4.2, 3.4, 4.2]} position={[0, GLOBE_Y, 0]} size={3} speed={0.35} color="#ffe39a" opacity={0.8} />
    </group>
  );
}
