import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Golden 100 SUARA star turning slowly on a pedestal in the middle of the Pentagon. */
const STAR_R = 1.15;
const STAR_Y = 2.15;
const SPIN = 0.35;

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? STAR_R : STAR_R * 0.45;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 3 });
  g.center();
  return g;
}

export function Centerpiece() {
  const geo = useMemo(starGeometry, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const gold = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#e6bb5c", metalness: 0.65, roughness: 0.3, clearcoat: 0.4 }),
    [],
  );
  const starMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#ffc93c", metalness: 0.55, roughness: 0.3, clearcoat: 0.4 }),
    [],
  );
  const star = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (star.current) {
      star.current.rotation.y += SPIN * Math.min(delta, 0.05);
      star.current.position.y = STAR_Y + Math.sin(t * 1.3) * 0.08;
    }
  });

  return (
    <group>
      {/* Pedestal */}
      <mesh material={gold} position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.1, 0.2, 5]} />
      </mesh>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.72, 0.85, 0.08, 40]} />
        <meshPhysicalMaterial color="#141012" roughness={0.2} clearcoat={1} />
      </mesh>
      <mesh material={gold} position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.2, 0.8, 16]} />
      </mesh>
      <group ref={star} position={[0, STAR_Y, 0]}>
        <mesh geometry={geo} material={starMat} castShadow />
      </group>
      <mesh material={gold} position={[0, STAR_Y, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[STAR_R + 0.45, 0.025, 8, 96]} />
      </mesh>
    </group>
  );
}
