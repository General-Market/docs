// Source: https://github.com/emmelleppi/threejs-challenge-0
import React, { useMemo, useEffect } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const INSTANCES_COUNT = 3000;
const SPHERE_RADIUS = 1.5;
const ORBIT_RADIUS = 1.9;
const CAPSULE_SCALE = 0.06;

// ── Shaders ─────────────────────────────────────────────────────────────

const heroVertexShader = /* glsl */ `
  attribute vec3 a_instancePos;
  attribute vec4 a_instanceQuaternions;

  varying vec3 v_worldPosition;
  varying vec2 v_uv;
  varying vec3 v_instancePos;
  varying vec3 v_viewPosition;
  varying vec3 v_viewNormal;
  varying vec3 v_modelPosition;
  varying vec3 v_worldNormal;

  uniform float u_scale;
  uniform vec3 u_sphere1Position;
  uniform vec3 u_sphere2Position;
  uniform vec3 u_sphere3Position;
  uniform vec3 u_sphere4Position;

  float linearStep(float edge0, float edge1, float x) {
    return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  }

  vec3 rotateByQuaternion(vec3 v, vec4 q) {
    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
  }

  vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
    return normalize((vec4(dir, 0.0) * matrix).xyz);
  }

  void main() {
    vec3 pos = position;
    vec3 norm = normal;

    float d1 = length(a_instancePos - u_sphere1Position);
    float d2 = length(a_instancePos - u_sphere2Position);
    float d3 = length(a_instancePos - u_sphere3Position);
    float d4 = length(a_instancePos - u_sphere4Position);

    float att = 4.0;
    float displacement = 1.0 - clamp(1.0 / (att * d1 * d1), 0.0, 1.0);
    displacement = min(displacement, 1.0 - clamp(1.0 / (att * d2 * d2), 0.0, 1.0));
    displacement = min(displacement, 1.0 - clamp(1.0 / (att * d3 * d3), 0.0, 1.0));
    displacement = min(displacement, 1.0 - clamp(1.0 / (att * d4 * d4), 0.0, 1.0));

    float tip = 1.0 - step(-2.5, pos.y);
    if (tip > 0.5) {
      pos.y = -2.5;
      norm = vec3(0, -1, 0);
    }

    pos = rotateByQuaternion(pos, a_instanceQuaternions);
    pos *= u_scale;
    pos += a_instancePos;
    pos += normalize(a_instancePos) * 0.4 * pow(displacement, 0.7);

    norm = rotateByQuaternion(norm, a_instanceQuaternions);

    vec4 viewPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    v_uv = uv;
    v_viewNormal = normalize(normalMatrix * norm);
    v_worldPosition = worldPosition.xyz;
    v_modelPosition = position;
    v_viewPosition = -viewPosition.xyz;
    v_instancePos = a_instancePos;
    v_worldNormal = inverseTransformDirection(v_viewNormal, viewMatrix);
  }
`;

// Matches the original's shadow = 0.4 + 0.6 * shadowMask pattern with
// analytical sphere-proximity shadows standing in for the shadow map.
const heroFragmentShader = /* glsl */ `
  varying vec3 v_worldPosition;
  varying vec2 v_uv;
  varying vec3 v_instancePos;
  varying vec3 v_viewPosition;
  varying vec3 v_viewNormal;
  varying vec3 v_modelPosition;
  varying vec3 v_worldNormal;

  uniform vec3 u_lightPosition;
  uniform vec3 u_color;
  uniform vec3 u_sphere1Position;
  uniform vec3 u_sphere2Position;
  uniform vec3 u_sphere3Position;
  uniform vec3 u_sphere4Position;

  float linearStep(float edge0, float edge1, float x) {
    return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  }

  void main() {
    vec3 viewNormal = normalize(v_viewNormal);
    vec3 L = normalize(u_lightPosition - v_instancePos);
    vec3 N = normalize(normalize(v_instancePos) + 0.2 * normalize(v_worldNormal));
    float NdL = max(0.0, dot(N, L));

    float distFromLight = length(u_lightPosition - v_worldPosition);
    float attenuation = 1.0 / (0.00025 * pow(distFromLight, 8.0));

    float ao = linearStep(-0.5, -3.0, v_modelPosition.y);

    // Analytical shadow from orbiting spheres — approximates the original's
    // shadow map with the 0.4 + 0.6 * shadow range.
    float sphereShadow = 1.0;
    float sd1 = length(v_instancePos - u_sphere1Position);
    float sd2 = length(v_instancePos - u_sphere2Position);
    float sd3 = length(v_instancePos - u_sphere3Position);
    float sd4 = length(v_instancePos - u_sphere4Position);
    sphereShadow *= smoothstep(0.15, 0.8, sd1);
    sphereShadow *= smoothstep(0.15, 0.8, sd2);
    sphereShadow *= smoothstep(0.15, 0.8, sd3);
    sphereShadow *= smoothstep(0.15, 0.8, sd4);
    float shadow = 0.4 + 0.6 * sphereShadow;

    vec3 color = u_color;
    color *= clamp(attenuation + smoothstep(-0.05, 1.0, NdL), 0.0, 1.0);
    color = pow(color, vec3(0.8));
    color *= ao * ao;
    color *= shadow;

    gl_FragColor = vec4(color, 1.0);
    gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0 / 2.2));
  }
`;

// The original sphere shader uses real scene-texture refraction through
// a blurred render target. Without useFrame / render-target blurring in
// Remotion, we approximate the effect: fresnel-based environment blend
// (sampling the gradient background colors), strong specular, and matcap.
const sphereFragmentShader = /* glsl */ `
  varying vec3 v_viewNormal;
  varying vec3 v_viewPosition;
  varying vec3 v_worldPosition;

  uniform vec3 u_lightPosition;
  uniform sampler2D u_matcap;
  uniform vec3 u_bgColor0;
  uniform vec3 u_bgColor1;

  vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
    return normalize((vec4(dir, 0.0) * matrix).xyz);
  }

  void main() {
    vec3 viewNormal = normalize(v_viewNormal);
    vec3 N = inverseTransformDirection(viewNormal, viewMatrix);
    vec3 V = normalize(cameraPosition - v_worldPosition);
    vec3 L = normalize(u_lightPosition - v_worldPosition);
    vec3 H = normalize(V + L);

    float NdL = max(0.0, dot(N, L));
    float spec = max(0.0, dot(H, N));
    float NdV = max(0.0, dot(N, V));
    float fresnel = pow(1.0 - NdV, 5.0);

    // Approximate refraction: bend the view through the sphere and sample
    // the background gradient in the refracted direction.
    float ior = 1.45;
    vec3 refracted = refract(-V, N, 1.0 / ior);
    float refractionU = refracted.x * 0.5 + 0.5;
    vec3 refractionColor = pow(mix(u_bgColor0, u_bgColor1, clamp(refractionU, 0.0, 1.0)), vec3(2.2));

    // Matcap for environment reflections
    vec3 viewDir = normalize(v_viewPosition);
    vec3 x = normalize(vec3(viewDir.z, 0.0, -viewDir.x));
    vec3 y = cross(viewDir, x);
    vec2 uv = vec2(dot(x, v_viewNormal), dot(y, v_viewNormal)) * 0.495 + 0.5;
    vec4 matcapColor = texture2D(u_matcap, uv);

    // Blend: refraction base + specular + matcap reflection + fresnel rim
    vec3 color = refractionColor * 0.7;
    color += 0.2 * pow(spec, 500.0);
    color += 0.03 * pow(matcapColor.rgb, vec3(2.2));
    color += 0.005 * fresnel;
    color += 0.05 * NdL;

    // Mix refraction and reflection via fresnel (more reflection at edges)
    color = mix(color, 0.04 * pow(matcapColor.rgb, vec3(2.2)) + 0.01 * fresnel, fresnel * 0.5);

    gl_FragColor = vec4(0.8 * color, 1.0);
    gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0 / 2.2));
  }
`;

const sphereVertexShader = /* glsl */ `
  varying vec3 v_viewNormal;
  varying vec3 v_worldPosition;
  varying vec3 v_viewPosition;

  void main() {
    vec3 pos = position;
    vec4 viewPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    v_viewNormal = normalMatrix * normal;
    v_worldPosition = worldPosition.xyz;
    v_viewPosition = -viewPosition.xyz;
  }
`;

// The original floor reads the shadow map. We approximate with distance
// falloff from the core sphere + orbiting spheres.
const floorVertexShader = /* glsl */ `
  varying vec3 v_viewNormal;
  varying vec3 v_worldPosition;
  varying vec3 v_viewPosition;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    v_viewNormal = normalMatrix * normal;
    v_worldPosition = worldPosition.xyz;
    v_viewPosition = -viewPosition.xyz;
  }
`;

const floorFragmentShader = /* glsl */ `
  varying vec3 v_viewNormal;
  varying vec3 v_worldPosition;
  varying vec3 v_viewPosition;

  uniform vec3 u_lightPosition;
  uniform vec3 u_sphere1Position;
  uniform vec3 u_sphere2Position;
  uniform vec3 u_sphere3Position;
  uniform vec3 u_sphere4Position;

  void main() {
    vec3 N = normalize(v_viewNormal);
    vec3 L = normalize(u_lightPosition - v_worldPosition);
    float NdL = max(0.0, dot(N, L));

    // Orbiting sphere contact shadows
    float shadow = 1.0;
    float d1 = length(v_worldPosition.xz - u_sphere1Position.xz);
    float d2 = length(v_worldPosition.xz - u_sphere2Position.xz);
    float d3 = length(v_worldPosition.xz - u_sphere3Position.xz);
    float d4 = length(v_worldPosition.xz - u_sphere4Position.xz);
    shadow *= smoothstep(0.2, 1.5, d1);
    shadow *= smoothstep(0.2, 1.5, d2);
    shadow *= smoothstep(0.2, 1.5, d3);
    shadow *= smoothstep(0.2, 1.5, d4);

    // Core capsule-ball shadow — matches the original's
    // directional shadow map projection
    float coreShadow = smoothstep(0.5, 2.5, length(v_worldPosition.xz));

    // Two-pass shadow blend like the original floor
    // (0.75 + 0.25 * shadow) * shadow
    float combined = min(shadow, coreShadow);
    float floorShadow = (0.75 + 0.25 * combined) * combined * NdL;

    gl_FragColor = vec4(vec3(0.0, 0.02, 0.0), 0.3 * (1.0 - floorShadow));
  }
`;

const bgVertexShader = /* glsl */ `
  varying vec2 v_uv;
  void main() {
    v_uv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const bgFragmentShader = /* glsl */ `
  varying vec2 v_uv;
  uniform vec3 u_color0;
  uniform vec3 u_color1;
  void main() {
    gl_FragColor = vec4(mix(u_color0, u_color1, v_uv.x), 1.0);
  }
`;

// ── Geometry builder ────────────────────────────────────────────────────

function buildInstancedGeometry(): THREE.InstancedBufferGeometry {
  const ref = new THREE.CapsuleGeometry(1, 4, 4, 16);
  ref.computeBoundingBox();

  const geo = new THREE.InstancedBufferGeometry();
  for (const id in ref.attributes) {
    geo.setAttribute(id, ref.attributes[id]);
  }
  geo.setIndex(ref.index);

  const positions = new Float32Array(INSTANCES_COUNT * 3);
  const quaternions = new Float32Array(INSTANCES_COUNT * 4);

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const up = new THREE.Vector3(0, 1, 0);
  const tempPos = new THREE.Vector3();
  const tempQuat = new THREE.Quaternion();

  for (let i = 0, i3 = 0, i4 = 0; i < INSTANCES_COUNT; i++, i3 += 3, i4 += 4) {
    const y = 1 - (i / (INSTANCES_COUNT - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;

    const x = Math.cos(theta) * radius * SPHERE_RADIUS;
    const z = Math.sin(theta) * radius * SPHERE_RADIUS;
    const posY = y * SPHERE_RADIUS;

    positions[i3] = x;
    positions[i3 + 1] = posY;
    positions[i3 + 2] = z;

    tempPos.set(-x, -posY, -z).normalize();
    tempQuat.setFromUnitVectors(up, tempPos);

    quaternions[i4] = tempQuat.x;
    quaternions[i4 + 1] = tempQuat.y;
    quaternions[i4 + 2] = tempQuat.z;
    quaternions[i4 + 3] = tempQuat.w;
  }

  geo.setAttribute("a_instancePos", new THREE.InstancedBufferAttribute(positions, 3));
  geo.setAttribute("a_instanceQuaternions", new THREE.InstancedBufferAttribute(quaternions, 4));

  return geo;
}

// ── Orbit configs for the 4 glass spheres ───────────────────────────────

const ORBIT_CONFIGS = [
  { speed: 1.0, phase: Math.PI / 1.1, plane: "yz" as const, dir: 1 },
  { speed: 0.75, phase: Math.PI / 3.4, plane: "xz" as const, dir: -1 },
  { speed: 0.5, phase: Math.PI / 2.2, plane: "yz" as const, dir: 1 },
  { speed: 1.2, phase: Math.PI / 1.7, plane: "xy" as const, dir: -1 },
];

function orbitPosition(
  t: number,
  config: (typeof ORBIT_CONFIGS)[number],
): [number, number, number] {
  const angle = config.dir * config.speed * t + config.phase;
  const r = ORBIT_RADIUS;
  if (config.plane === "xy") return [Math.cos(angle) * r, Math.sin(angle) * r, 0];
  if (config.plane === "xz") return [Math.cos(angle) * r, 0, Math.sin(angle) * r];
  return [0, Math.cos(angle) * r, Math.sin(angle) * r];
}

// ── Matcap texture loader ───────────────────────────────────────────────

function useMatcapTexture(): THREE.Texture | null {
  const [tex, setTex] = React.useState<THREE.Texture | null>(null);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(staticFile("three-challenge/glass.png"), (t) => {
      setTex(t);
    });
  }, []);
  return tex;
}

// ── Background colors (shared between BG shader and sphere refraction) ──

const BG_COLOR_0 = new THREE.Color("#AEB2B5");
const BG_COLOR_1 = new THREE.Color("#939A9D");

// ── Scene internals ─────────────────────────────────────────────────────

const lightPosition = new THREE.Vector3(-1, 0.8, 0.25).normalize().multiplyScalar(5);

function CapsuleHero({ time }: { time: number }) {
  const geometry = useMemo(() => buildInstancedGeometry(), []);

  const spherePositions = useMemo(() => {
    return ORBIT_CONFIGS.map((cfg) => orbitPosition(time, cfg));
  }, [time]);

  const uniforms = useMemo(
    () => ({
      u_scale: { value: CAPSULE_SCALE },
      u_lightPosition: { value: lightPosition },
      u_color: { value: new THREE.Color("#B2B8BB") },
      u_sphere1Position: { value: new THREE.Vector3() },
      u_sphere2Position: { value: new THREE.Vector3() },
      u_sphere3Position: { value: new THREE.Vector3() },
      u_sphere4Position: { value: new THREE.Vector3() },
    }),
    [],
  );

  uniforms.u_sphere1Position.value.set(...spherePositions[0]);
  uniforms.u_sphere2Position.value.set(...spherePositions[1]);
  uniforms.u_sphere3Position.value.set(...spherePositions[2]);
  uniforms.u_sphere4Position.value.set(...spherePositions[3]);

  return (
    <>
      <mesh renderOrder={-1}>
        <sphereGeometry args={[SPHERE_RADIUS, 32, 32]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <mesh geometry={geometry} renderOrder={0}>
        <shaderMaterial
          vertexShader={heroVertexShader}
          fragmentShader={heroFragmentShader}
          uniforms={uniforms}
        />
      </mesh>
    </>
  );
}

function GlassSpheres({ time, matcap }: { time: number; matcap: THREE.Texture | null }) {
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.3, 32, 32), []);

  const uniforms = useMemo(
    () => ({
      u_lightPosition: { value: lightPosition },
      u_matcap: { value: matcap },
      u_bgColor0: { value: BG_COLOR_0 },
      u_bgColor1: { value: BG_COLOR_1 },
    }),
    [],
  );

  uniforms.u_matcap.value = matcap;

  const positions = ORBIT_CONFIGS.map((cfg) => orbitPosition(time, cfg));

  return (
    <group>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos} renderOrder={1} geometry={sphereGeo}>
          <shaderMaterial
            vertexShader={sphereVertexShader}
            fragmentShader={sphereFragmentShader}
            uniforms={uniforms}
          />
        </mesh>
      ))}
    </group>
  );
}

function Floor({ time }: { time: number }) {
  const spherePositions = ORBIT_CONFIGS.map((cfg) => orbitPosition(time, cfg));

  const uniforms = useMemo(
    () => ({
      u_lightPosition: { value: lightPosition },
      u_sphere1Position: { value: new THREE.Vector3() },
      u_sphere2Position: { value: new THREE.Vector3() },
      u_sphere3Position: { value: new THREE.Vector3() },
      u_sphere4Position: { value: new THREE.Vector3() },
    }),
    [],
  );

  uniforms.u_sphere1Position.value.set(...spherePositions[0]);
  uniforms.u_sphere2Position.value.set(...spherePositions[1]);
  uniforms.u_sphere3Position.value.set(...spherePositions[2]);
  uniforms.u_sphere4Position.value.set(...spherePositions[3]);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[4, -3, -1.5]}>
      <planeGeometry args={[8, 8]} />
      <shaderMaterial
        vertexShader={floorVertexShader}
        fragmentShader={floorFragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

function Background() {
  const uniforms = useMemo(
    () => ({
      u_color0: { value: BG_COLOR_0 },
      u_color1: { value: BG_COLOR_1 },
    }),
    [],
  );

  return (
    <mesh renderOrder={-2}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={bgVertexShader}
        fragmentShader={bgFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

// ── Camera controller ───────────────────────────────────────────────────

function CameraRig({ time }: { time: number }) {
  const { camera } = useThree();

  useEffect(() => {
    const orbitAngle = time * 0.15;
    const camDist = 5.0;
    const camY = 0.3 + 0.5 * Math.sin(time * 0.2);

    camera.position.set(
      Math.sin(orbitAngle) * camDist,
      camY,
      Math.cos(orbitAngle) * camDist,
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, time]);

  return null;
}

// ── Main scene ──────────────────────────────────────────────────────────

function Scene({ time }: { time: number }) {
  const matcap = useMatcapTexture();

  return (
    <>
      <CameraRig time={time} />
      <Background />
      <CapsuleHero time={time} />
      <GlassSpheres time={time} matcap={matcap} />
      <Floor time={time} />
    </>
  );
}

// ── Remotion composition ────────────────────────────────────────────────

export const ThreeChallenge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  return (
    <AbsoluteFill style={{ backgroundColor: "#9FA5A8" }}>
      {/* Canvas with bloom approximation via CSS */}
      <div
        style={{
          width: "100%",
          height: "100%",
          filter: "contrast(1.08) brightness(1.04)",
        }}
      >
        <ThreeCanvas
          camera={{ position: [0, 0, 5], near: 0.1, far: 30, fov: 75 }}
          gl={{
            powerPreference: "high-performance",
            antialias: false,
            stencil: false,
            alpha: false,
          }}
          width={1920}
          height={1080}
          style={{ width: "100%", height: "100%" }}
        >
          <Scene time={time} />
        </ThreeCanvas>
      </div>

      {/* Vignette overlay — matches postprocessing VignetteEffect
          darkness: 0.6, offset: 0.3 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.35) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
