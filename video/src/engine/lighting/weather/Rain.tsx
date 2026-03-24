import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mulberry32 } from "../../../shorts/short-02/components/city/cityConfig";

const RAIN_COUNT = 200;

export const Rain: React.FC<{ frame: number }> = ({ frame }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const drops = useMemo(() => {
    const rng = mulberry32(7890);
    return Array.from({ length: RAIN_COUNT }, () => ({
      x: (rng() - 0.5) * 20,
      z: rng() * -20 - 2,
      speed: 0.15 + rng() * 0.15,
      offset: rng() * 100,
    }));
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const y = 8 - ((frame * d.speed + d.offset) % 10);
      dummy.position.set(d.x, y, d.z);
      dummy.rotation.set(0, 0, 0.1);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]}>
      <boxGeometry args={[0.01, 0.3, 0.01]} />
      <meshBasicMaterial color="#aabbcc" transparent opacity={0.4} />
    </instancedMesh>
  );
};
