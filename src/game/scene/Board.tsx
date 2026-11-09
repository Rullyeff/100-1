import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AREAS, TILES } from "../sim/board";
import { useGame } from "../store";
import { HOME_R, PLAYER_HEX, TILE, TILE_H, tileXform } from "./layout";
import { cornerTexture, surfaceNormal, tileTexture } from "./textures";
import { Buildings } from "./Buildings";

const paper = typeof document === "undefined" ? null : surfaceNormal("paper", 2);

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

const tileGeo = new THREE.BoxGeometry(TILE, TILE_H, TILE);
const discGeo = new THREE.CylinderGeometry(HOME_R, HOME_R, TILE_H + 0.04, 40);

export function Board({ onReady }: { onReady: () => void }) {
  const fontsReady = useFontsReady();

  const tops = useMemo(() => {
    if (!fontsReady) return null;
    return TILES.map((t) => (t.kind === "home" ? cornerTexture(t.area, AREAS[t.area]!.name) : tileTexture(t)));
  }, [fontsReady]);

  useEffect(() => {
    if (tops) onReady();
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
  const tile = TILES[index]!;
  const owner = useGame((s) => (tile.kind === "home" ? s.game.homeOwner[tile.area]! : s.game.owners[index]!));
  const level = useGame((s) => s.game.levels[index]!);

  const mats = useMemo(() => {
    const topMat = new THREE.MeshPhysicalMaterial({
      map: top ?? null,
      color: top ? "#d9d2c4" : "#cfc6b2",
      // Printed card under a thin satin varnish, not glossy plastic.
      normalMap: paper,
      normalScale: new THREE.Vector2(0.12, 0.12),
      roughness: 0.85,
    });
    return x.corner ? [sideMat, topMat, sideMat] : [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
  }, [top, sideMat, x.corner]);
  useEffect(() => () => mats.forEach((m) => m !== sideMat && m.dispose()), [mats, sideMat]);

  const captured = tile.kind === "home" && owner !== tile.area;
  const ownedPlot = tile.kind === "plot" && owner >= 0;

  return (
    <group position={[x.x, TILE_H / 2 + 0.02, x.z]} rotation-y={x.rotY}>
      <mesh geometry={x.corner ? discGeo : tileGeo} material={mats} receiveShadow castShadow />
      {ownedPlot && <OwnerGlow color={PLAYER_HEX[owner]!} />}
      {ownedPlot && (
        <group scale={0.6} position={[0, (TILE_H / 2 + 0.024) * 0.4, 0.37]}>
          <Buildings owner={owner} level={Math.max(1, level)} />
        </group>
      )}
      {captured && <CaptureFlag color={PLAYER_HEX[owner]!} />}
    </group>
  );
}

/** Glowing edge frame in the owner's colour so territory reads from afar. */
function OwnerGlow({ color }: { color: string }) {
  const y = TILE_H / 2 + 0.02;
  const t = 0.05;
  const s = TILE - 0.06;
  return (
    <group position={[0, y, 0]}>
      {[
        [0, -s / 2, s, t],
        [0, s / 2, s, t],
        [-s / 2, 0, t, s],
        [s / 2, 0, t, s],
      ].map(([px, pz, sx, sz], i) => (
        <mesh key={i} position={[px!, 0, pz!]}>
          <boxGeometry args={[sx!, 0.03, sz!]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Captured Gerbang Aman: the captor's banner planted on the disc. */
function CaptureFlag({ color }: { color: string }) {
  return (
    <group position={[0.32, TILE_H / 2 + 0.04, -0.2]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.9, 6]} />
        <meshStandardMaterial color="#e0b555" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.17, 0.78, 0]} castShadow>
        <boxGeometry args={[0.32, 0.2, 0.02]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
