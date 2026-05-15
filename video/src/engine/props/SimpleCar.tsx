import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { staticFile } from "remotion";
import { preloadOnce } from "../../lib/preloadOnce";

const CAR_URL = staticFile("models/car-sedan.glb");
preloadOnce(useGLTF.preload, CAR_URL);

export const SimpleCar: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({
  position,
  rotationY = Math.PI / 2,
}) => {
  const gltf = useGLTF(CAR_URL);
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[0.7, 0.7, 0.7]}>
      <primitive object={cloned} />
    </group>
  );
};
