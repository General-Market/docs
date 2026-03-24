import React, { useMemo } from "react";
import * as THREE from "three";

export const HeartSign: React.FC = () => {
  const heartGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.35);
    shape.bezierCurveTo(-0.05, -0.35, -0.25, -0.6, -0.5, -0.35);
    shape.bezierCurveTo(-0.75, -0.1, -0.75, 0.15, -0.5, 0.35);
    shape.bezierCurveTo(-0.3, 0.5, -0.05, 0.65, 0, 0.8);
    shape.bezierCurveTo(0.05, 0.65, 0.3, 0.5, 0.5, 0.35);
    shape.bezierCurveTo(0.75, 0.15, 0.75, -0.1, 0.5, -0.35);
    shape.bezierCurveTo(0.25, -0.6, 0.05, -0.35, 0, -0.35);
    const extrudeSettings = { depth: 0.25, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 4 };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);
  return (
    <group position={[0.85, 0.55, 0.05]} scale={[0.55, 0.55, 0.55]} rotation={[0, 0, Math.PI]}>
      <mesh geometry={heartGeo}>
        <meshStandardMaterial color="#e8192c" roughness={0.25} metalness={0.1} />
      </mesh>
    </group>
  );
};
