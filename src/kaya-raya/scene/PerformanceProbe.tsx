import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export function PerformanceProbe() {
  const { gl } = useThree();
  const report = useRef({ frames: 0, calls: 0, triangles: 0, intervalMs: 0, pixelRatio: 1, slowFrames: 0 });
  const totals = useRef({ calls: 0, triangles: 0 });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const original = gl.render.bind(gl);
    gl.render = (scene, camera) => {
      original(scene, camera);
      totals.current.calls += gl.info.render.calls;
      totals.current.triangles += gl.info.render.triangles;
    };
    return () => { gl.render = original; };
  }, [gl]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as unknown as { __kayaRayaPerformance?: { report: () => typeof report.current; markdown: () => string } };
    target.__kayaRayaPerformance = {
      report: () => ({ ...report.current }),
      markdown: () => Object.entries(report.current).map(([key, value]) => `- ${key}: ${value}`).join("\n"),
    };
    return () => { delete target.__kayaRayaPerformance; };
  }, []);
  useFrame((_, delta) => {
    if (!import.meta.env.DEV || document.hidden) return;
    const current = report.current;
    current.frames++;
    current.calls = totals.current.calls;
    current.triangles = totals.current.triangles;
    totals.current.calls = 0;
    totals.current.triangles = 0;
    current.intervalMs = Math.round(delta * 1000);
    current.pixelRatio = gl.getPixelRatio();
    if (delta > 0.05) current.slowFrames++;
  }, -100);
  return null;
}