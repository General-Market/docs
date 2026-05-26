// Source: todo.md §7 "UMBRAL" by Daniel Muñoz — concentric-ring shader floor
import React, { useMemo, useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── Floor shaders — ported verbatim from the UMBRAL demo ───────────────

const FLOOR_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLOOR_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uCircleSpacing;
  uniform float uLineWidth;
  uniform float uSpeed;
  uniform float uFadeEdge;
  uniform vec3 uCameraPosition;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 uv = vUv;
    float dist = distance(uv, center);

    float animatedDist = dist - uTime * uSpeed;

    float circle = mod(animatedDist, uCircleSpacing);

    float distFromEdge = min(circle, uCircleSpacing - circle);

    float aaWidth = length(vec2(dFdx(animatedDist), dFdy(animatedDist))) * 2.0;
    float lineAlpha = 1.0 - smoothstep(uLineWidth - aaWidth, uLineWidth + aaWidth, distFromEdge);

    vec3 baseColor = mix(vec3(1.0), vec3(0.0), lineAlpha);

    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(uCameraPosition - vPosition);

    vec3 lightDir = normalize(vec3(5.0, 10.0, 5.0));
    float NdotL = max(dot(normal, lightDir), 0.0);

    vec3 diffuse = baseColor * (0.5 + 0.5 * NdotL);

    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);
    vec3 specular = vec3(1.0) * spec * 0.8;

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
    vec3 fresnelColor = vec3(1.0) * fresnel * 0.3;

    vec3 finalColor = diffuse + specular + fresnelColor;

    float edgeFade = smoothstep(0.5 - uFadeEdge, 0.5, dist);
    float alpha = 1.0 - edgeFade;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// ── Ring-shader floor — a CircleGeometry laid flat, animated by uTime ──

const RingFloor: React.FC<{ time: number }> = ({ time }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0.0 },
      uCircleSpacing: { value: 0.06 },
      uLineWidth: { value: 0.02 },
      uSpeed: { value: 0.01 },
      uFadeEdge: { value: 0.2 },
      uCameraPosition: { value: new THREE.Vector3() },
    }),
    [],
  );

  // The original ran uTime at +0.016/frame on a 60fps rAF loop.
  // time is frame/fps (seconds), so time*60 reproduces that ramp exactly.
  if (matRef.current) {
    matRef.current.uniforms.uTime.value = time * 60.0;
    camera.getWorldPosition(matRef.current.uniforms.uCameraPosition.value);
  }

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      <circleGeometry args={[20, 200]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={FLOOR_VERTEX}
        fragmentShader={FLOOR_FRAGMENT}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent
      />
    </mesh>
  );
};

// ── Subject — a clean humanoid built from primitives, standing on the floor ──
// Replaces the demo's remote person.obj (jsdelivr) with a deterministic figure.

const Figure: React.FC = () => {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.7,
        metalness: 0.3,
      }),
    [],
  );

  return (
    <group position={[0, -1, 0]} rotation={[0, Math.PI / 3, 0]}>
      {/* legs */}
      <mesh position={[-0.32, 0.95, 0]} material={material}>
        <capsuleGeometry args={[0.26, 1.5, 8, 16]} />
      </mesh>
      <mesh position={[0.32, 0.95, 0]} material={material}>
        <capsuleGeometry args={[0.26, 1.5, 8, 16]} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 2.55, 0]} material={material}>
        <capsuleGeometry args={[0.55, 1.3, 8, 16]} />
      </mesh>
      {/* arms */}
      <mesh position={[-0.78, 2.6, 0]} rotation={[0, 0, 0.18]} material={material}>
        <capsuleGeometry args={[0.18, 1.6, 8, 16]} />
      </mesh>
      <mesh position={[0.78, 2.6, 0]} rotation={[0, 0, -0.18]} material={material}>
        <capsuleGeometry args={[0.18, 1.6, 8, 16]} />
      </mesh>
      {/* head */}
      <mesh position={[0, 3.85, 0]} material={material}>
        <sphereGeometry args={[0.46, 32, 32]} />
      </mesh>
    </group>
  );
};

// ── Camera rig — slow frame-driven orbit, replacing OrbitControls ──────

const CameraRig: React.FC<{ progress: number }> = ({ progress }) => {
  const { camera } = useThree();

  // The demo seeded the camera at (-7, -5, 11) looking at the origin, clamped
  // to a polar band by OrbitControls. We orbit gently inside that band.
  const radius = 14;
  const baseAngle = Math.atan2(11, -7); // original azimuth of (-7, z=11)
  const angle = baseAngle + interpolate(progress, [0, 1], [-0.32, 0.32]);

  const camY = interpolate(progress, [0, 0.5, 1], [3.4, 4.6, 3.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  camera.position.set(
    Math.cos(angle) * radius,
    camY,
    Math.sin(angle) * radius,
  );
  camera.lookAt(0, 0.5, 0);
  (camera as THREE.PerspectiveCamera).fov = 75;
  (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

  return null;
};

// ── Scene ──────────────────────────────────────────────────────────────

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <CameraRig progress={progress} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />

      <RingFloor time={time} />
      <Figure />
    </>
  );
};

// ── Title overlay — "UMBRAL", absolutely positioned, no interactivity ──

const TitleOverlay: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: "absolute",
      top: 50,
      left: 0,
      width: "100%",
      textAlign: "center",
      pointerEvents: "none",
      opacity,
      zIndex: 1,
    }}
  >
    <h1
      style={{
        display: "flex",
        justifyContent: "center",
        margin: 0,
        fontFamily: "Montserrat, Inter, sans-serif",
        fontSize: 180,
        textTransform: "uppercase",
        letterSpacing: 2,
        color: "#000",
        lineHeight: 1,
      }}
    >
      <span style={{ fontWeight: 900 }}>UM</span>
      <span style={{ fontWeight: 600 }}>BR</span>
      <span style={{ fontWeight: 300 }}>AL</span>
    </h1>
  </div>
);

// ── Composition ────────────────────────────────────────────────────────

export const UmbralFloor: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // The title eases in over the first half-second — alive on frame 1.
  const titleOpacity = interpolate(frame, [0, 30], [0.35, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 75, near: 0.1, far: 1000, position: [-7, 3.4, 11] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene />
      </ThreeCanvas>
      <TitleOverlay opacity={titleOpacity} />
    </AbsoluteFill>
  );
};
