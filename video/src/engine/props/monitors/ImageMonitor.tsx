import React from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { staticFile } from "remotion";

// ---------------------------------------------------------------------------
// Image-based monitor (loads a PNG screenshot as screen texture)
// ---------------------------------------------------------------------------

export const ImageMonitor: React.FC<{
  position: [number, number, number];
  screenW: number;
  screenH: number;
  imagePath: string;
  hideStand?: boolean;
}> = ({ position, screenW, screenH, imagePath, hideStand }) => {
  const texture = useLoader(THREE.TextureLoader, staticFile(imagePath));
  // NPOT-safe: 384px height is not power-of-2, so disable mipmaps
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[screenW + 0.016, screenH + 0.016, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      <mesh position={[0, -(screenH / 2 + 0.01), -0.008]}>
        <boxGeometry args={[screenW + 0.016, 0.025, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={1.2}
          roughness={0.1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {!hideStand && (
        <>
          <mesh position={[0, -(screenH / 2 + 0.10), -0.02]}>
            <boxGeometry args={[0.04, 0.18, 0.008]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
          <mesh position={[0, -(screenH / 2 + 0.18), 0.025]}>
            <boxGeometry args={[0.18, 0.012, 0.12]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
};
