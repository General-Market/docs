import React, { useMemo, useRef } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Shared texture dimensions
// ---------------------------------------------------------------------------
export const TEX_W = 512;
export const TEX_H = 384;

// ---------------------------------------------------------------------------
// Draw function signature used by MonitorScreen callers
// ---------------------------------------------------------------------------
export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
) => void;

// ---------------------------------------------------------------------------
// Monitor with canvas texture
// ---------------------------------------------------------------------------

export const MonitorScreen: React.FC<{
  position: [number, number, number];
  screenW: number;
  screenH: number;
  drawFn: DrawFn;
  frame: number;
  glowColor: string;
  hideStand?: boolean;
}> = ({ position, screenW, screenH, drawFn, frame, glowColor, hideStand }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    canvasRef.current = c;
    textureRef.current = t;
    return { canvas: c, texture: t };
  }, []);

  const ctx = canvas.getContext("2d");
  if (ctx) {
    drawFn(ctx, TEX_W, TEX_H, frame);
    texture.needsUpdate = true;
  }

  const glowCol = useMemo(() => new THREE.Color(glowColor), [glowColor]);

  return (
    <group position={position}>
      {/* Apple-style thin aluminum bezel */}
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[screenW + 0.016, screenH + 0.016, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      {/* Thin chin (Apple logo area) */}
      <mesh position={[0, -(screenH / 2 + 0.01), -0.008]}>
        <boxGeometry args={[screenW + 0.016, 0.025, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={1.5}
          roughness={0.1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {/* Glow light */}
      <pointLight
        position={[0, 0, 0.4]}
        intensity={0.5}
        color={glowCol}
        distance={2}
        decay={2}
      />
      {/* Apple-style single thin aluminum stand + base (hidden on top row) */}
      {!hideStand && (
        <>
          {/* Thin flat stand arm — extends from screen chin to desk surface */}
          <mesh position={[0, -(screenH / 2 + 0.10), -0.02]}>
            <boxGeometry args={[0.04, 0.18, 0.008]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
          {/* Flat rectangular base foot — sits ON desk surface, visible */}
          <mesh position={[0, -(screenH / 2 + 0.18), 0.025]}>
            <boxGeometry args={[0.18, 0.012, 0.12]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
};
