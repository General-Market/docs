/**
 * Shared fullscreen shader component using ThreeCanvas.
 * Pass vertex/fragment GLSL and it renders properly in Remotion.
 */
import React, { useMemo, useRef, useEffect } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

const defaultVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const ShaderQuad: React.FC<{
  fragmentShader: string;
  frame: number;
}> = ({ fragmentShader, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(width, height) },
    }),
    [width, height]
  );

  useEffect(() => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = frame / fps;
    }
  }, [frame, fps]);

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={defaultVertex}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
};

export const ShaderScene: React.FC<{ fragmentShader: string }> = ({
  fragmentShader,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: 90, near: 0.1, far: 10, position: [0, 0, 1] }}
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      style={{ background: "#000000" }}
    >
      <ShaderQuad fragmentShader={fragmentShader} frame={frame} />
    </ThreeCanvas>
  );
};
