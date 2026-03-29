/**
 * Phone3D — iPhone mockup using downloaded GLB model + screen content overlay.
 *
 * Uses the GLB at public/models/iphone.glb loaded via useGLTF.
 * Screen content is a React overlay positioned on top of the 3D phone.
 *
 * If the GLB fails to load, falls back to a simple CSS phone mockup
 * (rounded rect with shadow — NOT ExtrudeGeometry).
 *
 * Usage:
 *   <Phone3D
 *     rotateX={0} rotateY={-0.15} rotateZ={0.05}
 *     scale={1}
 *     screenContent={<MyAppUI />}
 *   />
 */

import React, { useMemo, Suspense } from "react";
import { staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { useGLTF, Environment, ContactShadows } from "@react-three/drei";

/* ══════════════════════════════════════════
   GLB Phone Model
   ══════════════════════════════════════════ */
const PhoneGLB: React.FC<{ url: string }> = ({ url }) => {
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => {
    const s = scene.clone();
    // Make materials more metallic/silver
    s.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const mat = child.material;
        if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
          // Brighten frame to titanium silver
          if (mat.metalness > 0.5) {
            mat.color = new THREE.Color("#d4d4d8");
            mat.metalness = 0.95;
            mat.roughness = 0.08;
          }
        }
      }
    });
    return s;
  }, [scene]);

  return <primitive object={cloned} />;
};

/* ══════════════════════════════════════════
   CSS Fallback Phone (simple, clean)
   ══════════════════════════════════════════ */
const CSSPhone: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      width: 280,
      height: 580,
      borderRadius: 36,
      background: "#1a1a1a",
      border: "3px solid #d4d4d8",
      boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset",
      overflow: "hidden",
      position: "relative",
      ...style,
    }}
  >
    {/* Dynamic Island */}
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        width: 90,
        height: 28,
        borderRadius: 14,
        background: "#000",
        zIndex: 10,
      }}
    />
    {/* Screen content */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 33,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  </div>
);

/* ══════════════════════════════════════════
   Phone3D — Main export
   ══════════════════════════════════════════ */
export const Phone3D: React.FC<{
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
  screenContent?: React.ReactNode;
  screenColor?: string;
  frameColor?: string;
  backColor?: string;
  opacity?: number;
  style?: React.CSSProperties;
  useGLB?: boolean;
}> = ({
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale = 1,
  screenContent,
  opacity = 1,
  style,
  useGLB: useGLBProp = false, // Default to CSS fallback — GLB needs testing per project
}) => {
  const glbUrl = staticFile("models/iphone.glb");

  if (useGLBProp) {
    return (
      <div
        style={{
          width: 320,
          height: 640,
          position: "relative",
          opacity,
          ...style,
        }}
      >
        {/* 3D Phone */}
        <ThreeCanvas
          width={320}
          height={640}
          style={{ position: "absolute", inset: 0 }}
          camera={{ position: [0, 0, 5], fov: 35 }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <directionalLight position={[-3, 2, 4]} intensity={0.4} />
          <Suspense fallback={null}>
            <group
              rotation={[rotateX, rotateY, rotateZ]}
              scale={[scale, scale, scale]}
            >
              <PhoneGLB url={glbUrl} />
            </group>
            <Environment preset="city" />
            <ContactShadows
              position={[0, -2.5, 0]}
              opacity={0.4}
              scale={8}
              blur={2.5}
            />
          </Suspense>
        </ThreeCanvas>

        {/* Screen overlay */}
        {screenContent && (
          <div
            style={{
              position: "absolute",
              top: "6%",
              left: "8%",
              right: "8%",
              bottom: "6%",
              borderRadius: 20,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            {screenContent}
          </div>
        )}
      </div>
    );
  }

  // CSS fallback — clean, fast, no Three.js overhead
  return (
    <div
      style={{
        transform: `perspective(800px) rotateX(${rotateX * (180 / Math.PI)}deg) rotateY(${rotateY * (180 / Math.PI)}deg) rotateZ(${rotateZ * (180 / Math.PI)}deg) scale(${scale})`,
        transformStyle: "preserve-3d",
        opacity,
        ...style,
      }}
    >
      <CSSPhone>
        {screenContent}
      </CSSPhone>
    </div>
  );
};

export default Phone3D;
