import { Component, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export function CityModel({ url, width, depth, height }: { url: string; width: number; depth: number; height: number }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const sx = width / Math.max(size.x, 0.001);
    const sy = height / Math.max(size.y, 0.001);
    const sz = depth / Math.max(size.z, 0.001);
    const root = new THREE.Group();
    clone.scale.set(sx, sy, sz);
    clone.position.set(-center.x * sx, -bounds.min.y * sy, -center.z * sz);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    root.add(clone);
    return root;
  }, [scene, width, depth, height]);
  return <primitive object={model} />;
}
/** Decorative city models must never take the whole board down if one fails to load. */
export class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.warn("City model failed to load", error); }
  render() { return this.state.failed ? null : this.props.children; }
}
