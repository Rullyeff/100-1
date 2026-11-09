import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { fx } from "../fx";
import { useGame } from "../store";
import { diceFace, shadowBlob } from "./textures";
import { DICE_HOME } from "./layout";

const SIZE = 1.05;
const REST_Y = SIZE / 2 + 0.03;
// Material order of BoxGeometry: +x, -x, +y, -y, +z, -z
const FACE_ORDER = [3, 4, 1, 6, 2, 5];
/** Chamfered resin cube; RoundedBoxGeometry keeps BoxGeometry's six face groups. */
const dieGeo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.1);
const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
/** Length and size of the settle pop that spotlights the result. */
const POP_SECONDS = 0.9;
const POP_SCALE = 0.22;

const e = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const FACE_UP: Record<number, THREE.Quaternion> = {
  1: e(0, 0, 0),
  6: e(Math.PI, 0, 0),
  2: e(-Math.PI / 2, 0, 0),
  5: e(Math.PI / 2, 0, 0),
  3: e(0, 0, Math.PI / 2),
  4: e(0, 0, -Math.PI / 2),
};

export function Dice() {
  const mats = useMemo(
    () =>
      FACE_ORDER.map(
        (n) => new THREE.MeshPhysicalMaterial({ map: diceFace(n), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 }),
      ),
    [],
  );
  useEffect(() => () => mats.forEach((m) => (m.map?.dispose(), m.dispose())), [mats]);
  return (
    <>
      <Die mats={mats} home={DICE_HOME} />
    </>
  );
}

function Die({ mats, home }: { mats: THREE.Material[]; home: [number, number] }) {
  const index = 0;
  const ref = useRef<THREE.Mesh>(null);
  const spin = useRef(new THREE.Vector3(7, 9, 5));
  const target = useRef(new THREE.Quaternion());
  /** Seconds since the die settled; drives a brief scale pop that spotlights the result. */
  const pop = useRef(POP_SECONDS);
  const wasRolling = useRef(false);
  const shadow = useRef<THREE.Mesh>(null);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: shadowBlob(), transparent: true, depthWrite: false, toneMapped: false }), []);
  useEffect(() => () => shadowMat.dispose(), [shadowMat]);
  const value = useGame((s) => s.dice);
  const rollId = useGame((s) => s.rollId);

  useEffect(() => {
    const yaw = e(0, (Math.random() - 0.5) * 1.2, 0);
    target.current.copy(yaw.multiply(FACE_UP[value]!));
    const k = 0.6 + fx.power;
    spin.current.set((6 + Math.random() * 8) * k, (6 + Math.random() * 8) * k, (4 + Math.random() * 8) * k);
  }, [value, rollId]);

  useFrame(({ clock }, delta) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    const rolling = useGame.getState().rolling;
    if (rolling) {
      m.rotation.x += spin.current.x * dt;
      m.rotation.y += spin.current.y * dt;
      m.rotation.z += spin.current.z * dt;
      const t = clock.elapsedTime * 9 + index;
      const p = fx.power;
      m.position.y = REST_Y + Math.abs(Math.sin(t)) * (0.7 + p * 1.6);
      m.position.x = home[0] + Math.sin(t * 0.7) * (0.3 + p * 0.5);
      m.position.z = home[1] + Math.cos(t * 0.6) * (0.3 + p * 0.5);
    } else {
      if (wasRolling.current) pop.current = 0;
      m.quaternion.slerp(target.current, 1 - Math.exp(-14 * dt));
      m.position.y += (REST_Y - m.position.y) * (1 - Math.exp(-12 * dt));
      m.position.x += (home[0] - m.position.x) * (1 - Math.exp(-8 * dt));
      m.position.z += (home[1] - m.position.z) * (1 - Math.exp(-8 * dt));
    }
    wasRolling.current = rolling;
    pop.current = Math.min(POP_SECONDS, pop.current + dt);
    const pt = pop.current / POP_SECONDS;
    // Delay the pop until the face has turned up, then swell and ease back.
    const swell = pt < 0.25 ? 0 : Math.sin(Math.PI * ((pt - 0.25) / 0.75));
    m.scale.setScalar(1 + swell * POP_SCALE);
    const sh = shadow.current;
    if (sh) {
      const lift = Math.max(0, m.position.y - REST_Y);
      sh.position.set(m.position.x, 0.012, m.position.z);
      sh.scale.setScalar(1 + lift * 0.4);
      shadowMat.opacity = 1 / (1 + lift * 0.9);
    }
  });

  return (
    <>
    <mesh ref={shadow} geometry={shadowGeo} material={shadowMat} rotation-x={-Math.PI / 2} position={[home[0], 0.012, home[1]]} renderOrder={1} />
    <Trail width={0.9} length={5} decay={1.5} color="#ffd36b" attenuation={(w) => w * w}>
      <mesh ref={ref} geometry={dieGeo} material={mats} position={[home[0], REST_Y, home[1]]} castShadow />
    </Trail>
    </>
  );
}
