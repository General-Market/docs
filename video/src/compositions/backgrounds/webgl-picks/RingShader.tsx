// Source: wasm.md scene #5 — kokomi.js ring shader
import React, { useRef, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── Post-processing fragment shader — verbatim from kokomi.js scene ────

const POST_FRAGMENT = /* glsl */ `
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;

uniform sampler2D tDiffuse;

varying vec2 vUv;

uniform vec3 uBgColor;
uniform float uRGBShiftIntensity;
uniform float uGrainIntensity;
uniform float uVignetteIntensity;
uniform float uTransitionProgress;

highp float random(vec2 co)
{
    highp float a=12.9898;
    highp float b=78.233;
    highp float c=43758.5453;
    highp float dt=dot(co.xy,vec2(a,b));
    highp float sn=mod(dt,3.14);
    return fract(sin(sn)*c);
}

vec3 grain(vec2 uv,vec3 col,float amount){
    float noise=random(uv+iTime);
    col+=(noise-.5)*amount;
    return col;
}

vec4 RGBShift(sampler2D tex,vec2 uv,float amount){
    vec2 rUv=uv;
    vec2 gUv=uv;
    vec2 bUv=uv;
    float noise=random(uv+iTime)*.5+.5;
    vec2 offset=amount*vec2(cos(noise),sin(noise));
    rUv+=offset;
    gUv+=offset*.5;
    bUv+=offset*.25;
    vec4 rTex=texture2D(tex,rUv);
    vec4 gTex=texture2D(tex,gUv);
    vec4 bTex=texture2D(tex,bUv);
    vec4 col=vec4(rTex.r,gTex.g,bTex.b,gTex.a);
    return col;
}

vec3 vignette(vec2 uv,vec3 col,vec3 vigColor,float amount){
    vec2 p=uv;
    p-=.5;
    float d=length(p);
    float mask=smoothstep(.5,.3,d);
    mask=pow(mask,.6);
    float mixFactor=(1.-mask)*amount;
    col=mix(col,vigColor,mixFactor);
    return col;
}

float sdCircle(vec2 p,float r)
{
    return length(p)-r;
}

vec3 transition(vec2 uv,vec3 col,float progress){
    float ratio=iResolution.x/iResolution.y;

    // circle
    vec2 p=uv;
    p-=.5;
    p.x*=ratio;
    float d=sdCircle(p,progress*sqrt(2.2));
    float c=smoothstep(-.2,0.,d);
    col=mix(vec3(1.),col,1.-c);
    return col;
}

void main(){
    vec2 uv=vUv;
    vec4 tex=RGBShift(tDiffuse,uv,uRGBShiftIntensity);
    vec3 col=tex.xyz;
    col=grain(uv,col,uGrainIntensity);
    col=vignette(uv,col,uBgColor,uVignetteIntensity);
    col=transition(uv,col,uTransitionProgress);
    gl_FragColor=vec4(col,1.);
}
`;

const POST_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ── Configuration ──────────────────────────────────────────────────────

const BG_COLOR = "#0c0c0c";
const BG_THREE = new THREE.Color(BG_COLOR);
const CIRCLE_COUNT = 3;
const CIRCLE_IMG_COUNT_UNIT = 12;
const BASE_RADIUS = 6.4;
const SCALE = 0.8;

const PALETTE = [
  "#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6",
  "#1abc9c", "#e67e22", "#34495e", "#c0392b", "#2980b9",
  "#27ae60", "#f39c12", "#8e44ad", "#16a085", "#d35400",
  "#2c3e50", "#e74c3c", "#3498db", "#2ecc71", "#f1c40f",
  "#9b59b6", "#1abc9c", "#e67e22", "#34495e",
];

const sumFormula = (n: number) => (n * (n + 1)) / 2;
const isOdd = (n: number) => n % 2 === 1;

// ── Imperative ring scene — built once, updated per frame ──────────────

interface RingWorld {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderTarget: THREE.WebGLRenderTarget;
  rings: THREE.Group[];
  lines: THREE.Group[];
}

function createCardTexture(color: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 80;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 80);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 56, 72);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildRingWorld(w: number, h: number): RingWorld {
  const scene = new THREE.Scene();
  scene.background = BG_THREE.clone();

  const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
  camera.position.set(0, 0, 16);

  const renderTarget = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });

  const texCache = new Map<string, THREE.Texture>();
  const getTexture = (color: string) => {
    if (!texCache.has(color)) texCache.set(color, createCardTexture(color));
    return texCache.get(color)!;
  };

  const rings: THREE.Group[] = [];
  const lines: THREE.Group[] = [];

  for (let i = 0; i < CIRCLE_COUNT; i++) {
    const c1 = sumFormula(i) * CIRCLE_IMG_COUNT_UNIT;
    const c2 = sumFormula(i + 1) * CIRCLE_IMG_COUNT_UNIT;
    const count = c2 - c1;

    const ring = new THREE.Group();
    scene.add(ring);
    rings.push(ring);

    for (let j = 0; j < count; j++) {
      const line = new THREE.Group();
      ring.add(line);
      lines.push(line);

      const imgScale = 0.005 * SCALE * (i * 0.36 + 1);
      const width = 320 * imgScale;
      const height = 400 * imgScale;
      const geometry = new THREE.PlaneGeometry(width, height);
      const color = PALETTE[(c1 + j) % PALETTE.length];
      const material = new THREE.MeshBasicMaterial({
        map: getTexture(color),
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const r = BASE_RADIUS * (i + 1);
      const ratio = j / count;
      const angle = ratio * Math.PI * 2;
      mesh.position.x = r;
      mesh.rotation.z = -Math.PI / 2;
      line.rotation.z = angle;
      line.add(mesh);
    }
  }

  return { scene, camera, renderTarget, rings, lines };
}

function updateRingWorld(
  world: RingWorld,
  time: number,
  enterProgress: number,
  rotateSpeed: number,
  scrollDelta: number,
) {
  world.rings.forEach((ring, i) => {
    const dir = isOdd(i) ? -1 : 1;
    ring.rotation.z = dir * 0.0025 * (1 + scrollDelta) * rotateSpeed * time * 60;
  });

  const lineZ =
    -THREE.MathUtils.lerp(
      0,
      100,
      THREE.MathUtils.mapLinear(scrollDelta, 0, 1000, 0, 1),
    ) + THREE.MathUtils.lerp(10, 0, enterProgress);

  world.lines.forEach((line) => {
    line.position.z = lineZ;
  });
}

function renderRingWorld(gl: THREE.WebGLRenderer, world: RingWorld) {
  const prevTarget = gl.getRenderTarget();
  gl.setRenderTarget(world.renderTarget);
  gl.setClearColor(BG_THREE, 1);
  gl.clear();
  gl.render(world.scene, world.camera);
  gl.setRenderTarget(prevTarget);
}

// ── Post-processing display — fullscreen quad with all FX ──────────────

const PostProcessScene: React.FC<{
  time: number;
  enterProgress: number;
  rotateSpeed: number;
  scrollDelta: number;
  transitionProgress: number;
}> = ({ time, enterProgress, rotateSpeed, scrollDelta, transitionProgress }) => {
  const { gl, size } = useThree();
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const world = useMemo(
    () => buildRingWorld(size.width, size.height),
    [size.width, size.height],
  );

  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(size.width, size.height) },
      iMouse: { value: new THREE.Vector2(0, 0) },
      tDiffuse: { value: world.renderTarget.texture },
      uBgColor: { value: BG_THREE.clone() },
      uRGBShiftIntensity: { value: 0.0025 },
      uGrainIntensity: { value: 0.025 },
      uVignetteIntensity: { value: 0.8 },
      uTransitionProgress: { value: 0 },
    }),
    [world.renderTarget.texture, size.width, size.height],
  );

  // Update ring world and render to RT — runs every Remotion frame
  updateRingWorld(world, time, enterProgress, rotateSpeed, scrollDelta);
  renderRingWorld(gl, world);

  // Update post-processing uniforms
  if (matRef.current) {
    matRef.current.uniforms.iTime.value = time;
    matRef.current.uniforms.uTransitionProgress.value = transitionProgress;
  }

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={POST_VERTEX}
        fragmentShader={POST_FRAGMENT}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

// ── "RING" title overlay ───────────────────────────────────────────────

const TitleOverlay: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      opacity,
      gap: 8,
    }}
  >
    <div
      style={{
        fontSize: 128,
        color: "white",
        fontFamily: "Inter, sans-serif",
        fontWeight: 400,
        letterSpacing: 4,
      }}
    >
      RING
    </div>
    <div
      style={{
        fontSize: 24,
        color: "#8a8a8a",
        fontFamily: "Inter, sans-serif",
      }}
    >
      Just drag and scroll~
    </div>
  </div>
);

// ── Main composition ───────────────────────────────────────────────────

export const RingShader: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const time = frame / fps;

  // Timeline — maps the original gsap timeline to frame-driven values
  // 0-60f (0-1s): circle transition wipe opens
  // 0-90f (0-1.5s): rings fly in from depth, rotation decelerates
  // 60-90f (1-1.5s): "RING" title fades in
  // 90-360f (1.5-6s): gentle rotation continues

  const transitionProgress = interpolate(frame, [0, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  const enterProgress = interpolate(frame, [0, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  const rotateSpeed = interpolate(frame, [0, 90], [10, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  const titleOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Gentle oscillating scroll to keep the rings alive after entrance
  const scrollDelta = interpolate(
    Math.sin(time * 0.8) * 0.5 + 0.5,
    [0, 1],
    [0, 30],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 50, near: 0.1, far: 10, position: [0, 0, 1] }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <PostProcessScene
          time={time}
          enterProgress={enterProgress}
          rotateSpeed={rotateSpeed}
          scrollDelta={scrollDelta}
          transitionProgress={transitionProgress}
        />
      </ThreeCanvas>
      <TitleOverlay opacity={titleOpacity} />
    </AbsoluteFill>
  );
};
