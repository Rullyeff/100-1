import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { fx } from "../fx";
import { Centerpiece } from "./Centerpiece";
import { Bloom, EffectComposer, SMAA, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Board } from "./Board";
import { Penthouse } from "./Penthouse";
import { Dice } from "./Dice";
import { Table } from "./Decor";
import { Tokens } from "./Tokens";
import { CashFx, CashPops } from "./Juice";
import { Spectacle, SpectacleOverlay } from "./Spectacle";
import { Traffic } from "./Traffic";
import { Streetscape } from "./Streetscape";
import { CityEdge } from "./CityEdge";
import { PerformanceProbe } from "./PerformanceProbe";
import { QualityContext } from "./quality";
import { useReducedMotion } from "./useReducedMotion";
import { useCinematic, milestone, CINEMATIC_SECONDS } from "./cinematic";
import { useGame } from "../store";
import { LOOK as PHASE_LOOK, PHASE_LABEL, ambience, phaseForRound, useTimeOfDay } from "./timeOfDay";

/** Eases sun, fill, spot, background and exposure toward the current day phase. */
function DayNight() {
  const lite = useContext(QualityContext);
  const { gl, scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const bg = useMemo(() => new THREE.Color(PHASE_LOOK.night.bg), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { scene.background = bg; return () => { scene.background = null; }; }, [scene, bg]);
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-1.5 * Math.min(delta, 0.05));
    const choice = useTimeOfDay.getState().choice;
    const look = PHASE_LOOK[choice === "auto" ? phaseForRound(useGame.getState().game.round) : choice];
    bg.lerp(tmp.set(look.bg), k);
    ambience.night += (look.night - ambience.night) * k;
    for (let i = 0; i < 3; i++) ambience.sky[i]! += (look.sky[i]! - ambience.sky[i]!) * k;
    scene.environmentIntensity += (look.env - scene.environmentIntensity) * k;
    gl.toneMappingExposure += (look.exposure - gl.toneMappingExposure) * k;
    if (sun.current) {
      sun.current.intensity += (look.sun - sun.current.intensity) * k;
      sun.current.color.lerp(tmp.set(look.sunColor), k);
      sun.current.position.lerp(pos.set(look.sunPos[0], look.sunPos[1], look.sunPos[2]), k);
    }
    if (hemi.current) hemi.current.intensity += (look.hemi - hemi.current.intensity) * k;
    if (spot.current) spot.current.intensity += (look.spot - spot.current.intensity) * k;
  });
  return <>
    <hemisphereLight ref={hemi} args={["#fff4e0", "#1a1416", 0.16]} />
    <spotLight ref={spot} position={[0, 16, 0]} angle={0.34} penumbra={0.9} intensity={2.2} decay={0} color="#ffe7b8" />
    <directionalLight
      ref={sun}
      position={[-8, 16, -6]}
      intensity={0.55}
      castShadow={!lite}
      shadow-mapSize={[2048, 2048]}
      shadow-radius={6}
      shadow-normalBias={0.02}
      shadow-camera-left={-14}
      shadow-camera-right={14}
      shadow-camera-top={14}
      shadow-camera-bottom={-14}
      shadow-bias={-0.0005}
    />
  </>;
}
import { tileXform } from "./layout";
import { DICE_CLOSEUP_SECONDS, SHOWCASE_SECONDS, pickShot, showcaseTile, startsDiceCloseup } from "./director";

function CinematicEvents() {
  const banner = useGame((s) => s.banner);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    useCinematic.getState().skip();
  }, []);
  useEffect(() => {
    if (!banner) return;
    const tiles = milestone(banner.title, banner.player, useGame.getState().game);
    if (!tiles) return;
    if (timer.current) clearTimeout(timer.current);
    useCinematic.getState().show({ id: banner.id, title: banner.title, text: banner.text, tiles });
    timer.current = setTimeout(() => {
      if (useCinematic.getState().event?.id === banner.id) useCinematic.getState().skip();
    }, CINEMATIC_SECONDS * 1000);
  }, [banner]);
  return null;
}

const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
const UP = new THREE.Vector3(0, 1, 0);
const DEFAULT_ELEV = Math.atan2(CAM_DIR.y, Math.hypot(CAM_DIR.x, CAM_DIR.z));
/** Elevation limits: almost flat from the side up to almost straight down from above. */
const MIN_ELEV = 0.14;
const MAX_ELEV = 1.5;
const FOV = 30;

const LOOK = new THREE.Vector3(0, -0.8, 0);
/** Pointer travel (px) before a press becomes a table drag instead of a tile click. */
const DRAG_START_PX = 6;
const SHAKE_DECAY = 7;
/** User zoom range: >1 moves the camera closer. */
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.6;

const DICE_CENTER = new THREE.Vector3(2.2, 0.4, 2.2);
/** Resting dice (their homes in Dice.tsx), framed by the post-throw close-up. */
const DICE_REST = new THREE.Vector3(2.2, 0.42, 2.2);
/** Close-up eye distance from the dice: near enough for chamfers and shadows, still inside the board ring. */
const CLOSEUP_MIN_DIST = 4;
const CLOSEUP_MAX_DIST = 6.5;
/** Half-width (world units) of the pair of dice the close-up tries to keep in frame. */
const CLOSEUP_HALF_WIDTH = 1.35;
/** Shot tuning: zoom = how far the eye travels toward the subject, low = how far elevation drops toward LOW_ELEV. */
const SHOT = {
  idle: { zoom: 0, low: 0, rate: 3 },
  track: { zoom: 0.32, low: 0.12, rate: 3.5 },
  dice: { zoom: 0.62, low: 0.35, rate: 4 },
  closeup: { zoom: 1, low: 1, rate: 5 },
  punch: { zoom: 0.7, low: 0, rate: 14 },
  milestone: { zoom: 0.8, low: 0.15, rate: 6 },
  showcase: { zoom: 1, low: 1, rate: 3.2 },
} as const;
const LOW_ELEV = 0.3;
const LOW_CLOSE = 0.42;
const SHOWCASE_SWEEP = 0.35;
const TRACK_DECAY = 2.2;

/** Keeps the whole board in view for any aspect ratio, plus breathing drift, impact shake and cinematic shots. */
function CameraRig({ orbit }: { orbit: React.RefObject<{ yaw: number; pitch: number; zoom: number }> }) {
  const { camera, size } = useThree();
  const reduced = useReducedMotion();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const last = useRef("");
  const base = useRef(new THREE.Vector3());
  const focus = useRef(LOOK.clone());
  const aim = useRef(new THREE.Vector3());
  const want = useRef(new THREE.Vector3());
  const wantFocus = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const orbited = useRef(new THREE.Vector3());
  const zoom = useRef(0);
  const low = useRef(0);
  const sweep = useRef(0);
  const showcase = useRef({ tile: -1, t: SHOWCASE_SECONDS });
  const closeup = useRef(DICE_CLOSEUP_SECONDS);
  const close = useRef(0.63);
  const userZoom = useRef(1);

  // A new hotel or landmark earns a low-angle tilt-up, and the player's own throw
  // earns a dice close-up once they settle. Observe state only, never touch pacing.
  useEffect(() => {
    let prev = useGame.getState().game.levels;
    let wasRolling = useGame.getState().rolling;
    return useGame.subscribe((st) => {
      if (st.rolling !== wasRolling) {
        const roller = st.game.players[st.game.turn];
        if (startsDiceCloseup(wasRolling, st.rolling, roller?.isBot ?? true)) closeup.current = 0;
        wasRolling = st.rolling;
      }
      const next = st.game.levels;
      if (next === prev) return;
      const tile = showcaseTile(prev, next);
      prev = next;
      if (tile !== null) showcase.current = { tile, t: 0 };
    });
  }, []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const key = `${size.width}x${size.height}`;
    if (key !== last.current) {
      last.current = key;
      const aspect = size.width / size.height;
      const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const tanH = tanV * aspect;
      const dist = Math.max(10.6 / tanV, (aspect < 1 ? 11.2 : 12.6) / tanH);
      base.current.copy(CAM_DIR).multiplyScalar(dist);
      camera.updateProjectionMatrix();
    }
    // Ease toward the drag orbit so releasing the pointer glides to a stop.
    yaw.current += (orbit.current.yaw - yaw.current) * (1 - Math.exp(-10 * dt));
    pitch.current += (orbit.current.pitch - pitch.current) * (1 - Math.exp(-10 * dt));
    userZoom.current += (orbit.current.zoom - userZoom.current) * (1 - Math.exp(-10 * dt));

    // Pick the cinematic shot and its subject.
    const sc = showcase.current;
    sc.t += dt;
    closeup.current += dt;
    const event = useCinematic.getState().event;
    const kind = reduced
      ? "idle"
      : pickShot({
          showcase: sc.tile >= 0 && sc.t < SHOWCASE_SECONDS,
          milestone: !!event,
          punch: fx.punch,
          closeup: closeup.current < DICE_CLOSEUP_SECONDS,
          rolling: useGame.getState().rolling,
          track: fx.track,
        });
    if (kind === "showcase") {
      const x = tileXform(sc.tile);
      want.current.set(x.x, 0.5, x.z);
      wantFocus.current.set(x.x, 1.25, x.z);
    } else if (kind === "milestone" && event) {
      const tiles = event.tiles.map(tileXform);
      want.current.set(tiles.reduce((a, t) => a + t.x, 0) / tiles.length, 0.5, tiles.reduce((a, t) => a + t.z, 0) / tiles.length);
      wantFocus.current.copy(want.current);
    } else if (kind === "punch") {
      want.current.set(fx.punchX, 0.5, fx.punchZ);
      wantFocus.current.copy(want.current);
    } else if (kind === "closeup") {
      want.current.copy(DICE_REST);
      wantFocus.current.copy(DICE_REST);
    } else if (kind === "dice") {
      want.current.copy(DICE_CENTER);
      wantFocus.current.copy(DICE_CENTER);
    } else if (kind === "track") {
      want.current.set(fx.trackX, 0.4, fx.trackZ);
      wantFocus.current.copy(want.current);
    } else {
      want.current.set(0, 0, 0);
      wantFocus.current.copy(LOOK);
    }
    const shot = SHOT[kind];
    const k = 1 - Math.exp(-shot.rate * dt);
    const wantZoom = kind === "punch" ? Math.max(zoom.current * Math.exp(-3 * dt), fx.punch * shot.zoom) : shot.zoom;
    zoom.current += (wantZoom - zoom.current) * k;
    low.current += (shot.low - low.current) * k;
    sweep.current += ((kind === "showcase" ? (sc.t / SHOWCASE_SECONDS) * SHOWCASE_SWEEP : 0) - sweep.current) * k;
    aim.current.lerp(want.current, k);
    focus.current.lerp(wantFocus.current, k);
    fx.punch *= Math.exp(-1.6 * dt);
    fx.track *= Math.exp(-TRACK_DECAY * dt);

    // Spherical orbit: yaw spins around the table, pitch tilts from side view to top view.
    const len = base.current.length();
    const userElev = THREE.MathUtils.clamp(DEFAULT_ELEV + pitch.current, MIN_ELEV, MAX_ELEV);
    const elev = THREE.MathUtils.lerp(userElev, Math.min(userElev, LOW_ELEV), low.current);
    orbited.current.copy(base.current).applyAxisAngle(UP, yaw.current + sweep.current);
    const horiz = Math.hypot(orbited.current.x, orbited.current.z) || 1;
    const horizScale = (Math.cos(elev) * len) / horiz;
    orbited.current.x *= horizScale;
    orbited.current.z *= horizScale;
    orbited.current.y = Math.sin(elev) * len;
    const t = clock.elapsedTime;
    const s = reduced ? 0 : fx.shake;
    camera.position.set(
      orbited.current.x + (reduced ? 0 : Math.sin(t * 0.21) * 0.35) + (Math.random() - 0.5) * s,
      orbited.current.y + (reduced ? 0 : Math.sin(t * 0.17) * 0.2) + (Math.random() - 0.5) * s,
      orbited.current.z + (reduced ? 0 : Math.cos(t * 0.19) * 0.35) + (Math.random() - 0.5) * s,
    );
    // Translate both eye and target together; the subject stays centered.
    // Low-angle shots also move in closer, so the subject stays large against the skyline.
    // The dice close-up sits at an absolute distance; ease the scale so shot changes never jump.
    let wantClose = (size.width < size.height ? 0.74 : 0.63) * (1 - LOW_CLOSE * low.current);
    if (kind === "closeup") {
      const tanH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (size.width / size.height);
      wantClose = THREE.MathUtils.clamp(CLOSEUP_HALF_WIDTH / tanH, CLOSEUP_MIN_DIST, CLOSEUP_MAX_DIST) / len;
    }
    close.current += (wantClose - close.current) * k;
    desired.current.copy(orbited.current).multiplyScalar(close.current).add(aim.current);
    camera.position.lerp(desired.current, zoom.current);
    // User zoom applies to every shot, including idle: dolly the eye toward the focus.
    if (userZoom.current !== 1) {
      camera.position.sub(focus.current).multiplyScalar(1 / userZoom.current).add(focus.current);
    }
    camera.lookAt(focus.current);
    fx.shake = s * Math.exp(-SHAKE_DECAY * dt);
    if (fx.shake < 0.002) fx.shake = 0;
  });
  return null;
}

function AdaptiveResolution({ lite }: { lite: boolean }) {
  const { gl, setDpr } = useThree();
  const sample = useRef({ seconds: 0, frames: 0, level: 0, good: 0 });
  useFrame((_, delta) => {
    if (document.hidden) return;
    const s = sample.current;
    s.seconds += Math.min(delta, 0.25);
    s.frames++;
    if (s.seconds < 4) return;
    const fps = s.frames / s.seconds;
    if (fps < 26 && s.level < 2) { s.level++; s.good = 0; }
    else if (fps > 52 && s.level > 0) { s.good++; if (s.good >= 3) { s.level--; s.good = 0; } }
    else s.good = 0;
    const ratio = (lite ? 1 : Math.min(window.devicePixelRatio, 1.5)) * ([1, 0.85, 0.72][s.level] ?? 0.72);
    if (Math.abs(gl.getPixelRatio() - ratio) > 0.01) setDpr(ratio);
    s.seconds = 0; s.frames = 0;
  });
  return null;
}

function ReadySignal({ ready, target }: { ready: boolean; target: React.RefObject<HTMLDivElement | null> }) {
  const frames = useRef(0);
  useFrame(() => {
    if (!ready || !target.current || target.current.dataset["sceneReady"]) return;
    if (++frames.current >= 2) target.current.dataset["sceneReady"] = "1";
  });
  return null;
}

export default function GameScene() {
  const wrap = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const [autoLite, setAutoLite] = useState(true);
  const [ultra, setUltra] = useState(false);
  useEffect(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setAutoLite(window.matchMedia("(max-width: 768px), (pointer: coarse)").matches || (memory !== undefined && memory <= 4) || navigator.hardwareConcurrency <= 4);
    setUltra(localStorage.getItem("kaya-raya-ultra") === "1");
  }, []);
  const lite = autoLite && !ultra;
  const toggleUltra = () => setUltra((u) => { localStorage.setItem("kaya-raya-ultra", u ? "0" : "1"); return !u; });

  // Drag-to-orbit: pointer movement rotates the table (yaw) and tilts it (pitch).
  const orbit = useRef({ yaw: 0, pitch: 0, zoom: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const setZoom = (z: number) => {
    orbit.current.zoom = THREE.MathUtils.clamp(z, ZOOM_MIN, ZOOM_MAX);
    if (!orbiting) setOrbiting(true);
  };
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.target instanceof HTMLCanvasElement)) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setZoomRef.current(orbit.current.zoom * Math.exp(-dy * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const setZoomRef = useRef(setZoom);
  setZoomRef.current = setZoom;
  const drag = useRef<{ id: number; x: number; y: number; sx: number; sy: number; active: boolean } | null>(null);
  const [orbiting, setOrbiting] = useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!(e.target instanceof HTMLCanvasElement)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; pinch.current = Math.hypot(a!.x - b!.x, a!.y - b!.y); drag.current = null; return; }
    // Capture only once it is clearly a drag: capturing on press retargets the
    // click away from the canvas, so tapping a tile (e.g. a travel pick) did nothing.
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinch.current > 0) setZoom(orbit.current.zoom * (dist / pinch.current));
      pinch.current = dist;
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_START_PX) return;
      d.active = true;
      d.x = e.clientX;
      d.y = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    orbit.current.yaw -= (e.clientX - d.x) * 0.006;
    orbit.current.pitch = THREE.MathUtils.clamp(orbit.current.pitch + (e.clientY - d.y) * 0.004, MIN_ELEV - DEFAULT_ELEV, MAX_ELEV - DEFAULT_ELEV);
    d.x = e.clientX;
    d.y = e.clientY;
    if (!orbiting) setOrbiting(true);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = 0;
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const timeChoice = useTimeOfDay((t) => t.choice);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const resetOrbit = () => {
    orbit.current.yaw = 0;
    orbit.current.pitch = 0;
    orbit.current.zoom = 1;
    setOrbiting(false);
  };

  return (
    <div
      ref={wrap}
      className="absolute inset-0 touch-none"
      data-quality={lite ? "lite" : "full"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <CinematicEvents />
      <Canvas
        dpr={lite ? 1 : [1, 1.5]}
        camera={{ fov: FOV, near: 0.5, far: 300, position: [30, 36, 30] }}
        gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 0.95 }}
        shadows={lite ? false : "soft"}
      >
        <QualityContext value={lite}>
        <Penthouse />
        <CameraRig orbit={orbit} />
        <AdaptiveResolution lite={lite} />
        <DayNight />
        <Environment resolution={128}>
          <Lightformer intensity={2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
          <Lightformer intensity={1.2} color="#ffd9a8" position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
          <Lightformer intensity={0.8} color="#a8d0ff" position={[6, 2, -4]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} />
          <Lightformer form="ring" intensity={3} color="#fff6e6" position={[-4, 8, -6]} scale={3} />
          <Lightformer intensity={0.6} color="#ffe2c2" position={[0, 1, 9]} scale={[20, 1.5, 1]} />
        </Environment>
        <Table lite={lite} />
        <Board onReady={onReady} />
        <Traffic />
        <Streetscape />
        <CityEdge />
        <Tokens />
        <Dice />
        <CashFx />
        <Spectacle />
        <Centerpiece />
        {!lite && <EffectComposer multisampling={0}>
          <Bloom intensity={0.4} luminanceThreshold={0.95} luminanceSmoothing={0.2} mipmapBlur />
          <SMAA />
          <Vignette offset={0.25} darkness={0.7} />
        </EffectComposer>}
        <ReadySignal ready={ready} target={wrap} />
        {import.meta.env.DEV && <PerformanceProbe />}
        </QualityContext>
      </Canvas>
      <CashPops />
      <SpectacleOverlay />
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 short:bottom-1.5 whitespace-nowrap [@media(max-height:500px)]:gap-1 portrait:bottom-28 sm:portrait:bottom-32">
      <button
        type="button"
        onClick={toggleUltra}
        aria-pressed={ultra}
        className="rounded-full [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:text-[10px] border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-card-foreground backdrop-blur"
      >
        Grafis: {ultra ? "Ultra" : lite ? "Hemat" : "Tinggi"}
      </button>
      <button
        type="button"
        onClick={() => useTimeOfDay.getState().cycle()}
        className="rounded-full [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:text-[10px] border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-card-foreground backdrop-blur"
      >
        Waktu: {PHASE_LABEL[timeChoice]}
      </button>
      <button
        type="button"
        onClick={toggleFull}
        aria-pressed={full}
        className="rounded-full [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:text-[10px] border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-card-foreground backdrop-blur"
      >
        {full ? "Keluar Layar Penuh" : "Layar Penuh"}
      </button>
      </div>
      <div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 sm:left-4">
        {[["+", 1.25, "Perbesar"], ["−", 0.8, "Perkecil"]].map(([l, f, label]) => (
          <button key={label as string} type="button" aria-label={label as string} onClick={() => setZoom(orbit.current.zoom * (f as number))}
            className="h-10 w-10 rounded-full border border-border bg-card/80 text-lg font-bold text-card-foreground backdrop-blur">{l}</button>
        ))}
      </div>
      {orbiting && (
        <button
          type="button"
          onClick={resetOrbit}
          className="absolute bottom-3 right-3 z-20 rounded-full portrait:bottom-40 sm:portrait:bottom-44 border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-card-foreground backdrop-blur"
        >
          Reset Sudut
        </button>
      )}
    </div>
  );
}
