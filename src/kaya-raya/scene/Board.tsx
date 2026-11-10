import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TILES } from "../sim/board";
import { useGame } from "../store";
import { CORNER, PLAYER_HEX, TILE_D, TILE_H, TILE_W, tileXform } from "./layout";
import { cornerTexture, surfaceNormal, tileTexture } from "./textures";

const paper = typeof document === "undefined" ? null : surfaceNormal("paper", 2);
import { Buildings } from "./Buildings";
import { BoardEventMark } from "./BoardEventMark";
import { activeBoardEvent } from "../sim/events";

function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const timer = setTimeout(finish, 2500);
    document.fonts
      ?.load('64px "Lilita One"')
      .then(() => document.fonts.ready)
      .then(finish)
      .catch(finish);
    return () => clearTimeout(timer);
  }, []);
  return ready;
}

export function Board({ onReady }: { onReady: () => void }) {
  const fontsReady = useFontsReady();

  const tops = useMemo(() => {
    if (!fontsReady) return null;
    return TILES.map((t, i) => {
      const x = tileXform(i);
      return x.corner ? cornerTexture(t.kind) : tileTexture(t, x.flip);
    });
  }, [fontsReady]);

  useEffect(() => {
    if (tops) onReady();
    return () => tops?.forEach((t) => t.dispose());
  }, [tops, onReady]);

  const sideMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#d9b46a", roughness: 0.6, metalness: 0.5 }), []);

  return (
    <group>
      {TILES.map((t, i) => (
        <TileMesh key={i} index={i} top={tops?.[i] ?? null} sideMat={sideMat} />
      ))}
    </group>
  );
}

function TileMesh({ index, top, sideMat }: { index: number; top: THREE.Texture | null; sideMat: THREE.Material }) {
  const x = tileXform(index);
  const w = x.corner ? CORNER : TILE_W;
  const d = x.corner ? CORNER : TILE_D;
  const owner = useGame((s) => s.game.owners[index]!);
  const level = useGame((s) => s.game.levels[index]!);
  const festival = useGame((s) => s.game.festival === index);
  const event = useGame((s) => activeBoardEvent(s.game, index));
  const awaiting = useGame((s) => s.awaiting);
  const answer = useGame((s) => s.answer);
  const pickable = awaiting?.kind === "pick" && awaiting.tiles.includes(index);

  const mats = useMemo(() => {
    const topMat = new THREE.MeshPhysicalMaterial({
      map: top ?? null,
      color: top ? "#ece6d8" : "#e6dcc6",
      // Printed card under a thin satin varnish, not glossy plastic.
      normalMap: paper,
      normalScale: new THREE.Vector2(0.12, 0.12),
      roughness: 0.85,
    });
    return [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
  }, [top, sideMat]);
  useEffect(() => () => mats[2]!.dispose(), [mats]);

  return (
    <group position={[x.x, TILE_H / 2 + 0.02, x.z]} rotation-y={x.rotY}>
      <mesh
        material={mats}
        receiveShadow
        castShadow
        onClick={(e) => {
          if (!pickable) return;
          e.stopPropagation();
          answer(index);
        }}
        onPointerOver={() => pickable && (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <boxGeometry args={[w - 0.06, TILE_H, d - 0.06]} />
      </mesh>
      {owner >= 0 && (
        <mesh position={[0, TILE_H / 2 + 0.012, -0.62]} receiveShadow>
          <boxGeometry args={[w - 0.22, 0.024, 0.95]} />
          <meshStandardMaterial color={PLAYER_HEX[owner]!} roughness={0.5} />
        </mesh>
      )}
      {owner >= 0 && <OwnerGlow w={w} d={d} color={PLAYER_HEX[owner]!} />}
      {owner >= 0 && <Buildings owner={owner} level={level} />}
      {event && <BoardEventMark kind={event.kind} />}
      {festival && <FestivalMark />}
      {pickable && <PickGlow w={w} d={d} />}
    </group>
  );
}

/** Glowing edge frame in the owner's color so territory reads from afar. */
function OwnerGlow({ w, d, color }: { w: number; d: number; color: string }) {
  const y = TILE_H / 2 + 0.02;
  const t = 0.06;
  const iw = w - 0.1;
  const id = d - 0.1;
  return (
    <group position={[0, y, 0]}>
      {[
        [0, -id / 2, iw, t],
        [0, id / 2, iw, t],
        [-iw / 2, 0, t, id],
        [iw / 2, 0, t, id],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x!, 0, z!]}>
          <boxGeometry args={[sx!, 0.03, sz!]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function PickGlow({ w, d }: { w: number; d: number }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.25 + Math.sin(clock.elapsedTime * 5) * 0.15;
  });
  return (
    <mesh position={[0, TILE_H / 2 + 0.05, 0]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[w - 0.1, d - 0.1]} />
      <meshBasicMaterial ref={mat} color="#ffe066" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

function FestivalMark() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.rotation.y = clock.elapsedTime * 1.5;
    g.current.position.y = 2.2 + Math.sin(clock.elapsedTime * 2) * 0.12;
  });
  return (
    <group ref={g} position={[0, 2.2, -0.2]}>
      <mesh castShadow>
        <octahedronGeometry args={[0.32]} />
        <meshStandardMaterial color="#ffc93c" metalness={0.8} roughness={0.25} emissive="#a86b00" emissiveIntensity={0.4} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.5, 0.05, 8, 32]} />
        <meshStandardMaterial color="#ffd95e" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}
