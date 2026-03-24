import React, { Suspense, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
// @ts-ignore
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

// ── All models to showcase ──────────────────────────────────────────────────
interface ModelDef {
  file: string;
  label: string;
  scale: number;
  animations: { name: string; label: string }[];
  yOffset?: number;
}

const MODELS: ModelDef[] = [
  {
    file: "RobotExpressive.glb",
    label: "Robot Expressive",
    scale: 0.65,
    animations: [
      { name: "Walking", label: "Walk" },
      { name: "Dance", label: "Dance" },
      { name: "Idle", label: "Idle" },
      { name: "Jump", label: "Jump" },
      { name: "Wave", label: "Wave" },
      { name: "ThumbsUp", label: "Thumbs Up" },
      { name: "Punch", label: "Punch" },
      { name: "Yes", label: "Yes" },
    ],
  },
  {
    file: "Xbot.glb",
    label: "X-Bot (Mixamo)",
    scale: 0.55,
    animations: [
      { name: "walk", label: "Walk" },
      { name: "run", label: "Run" },
      { name: "idle", label: "Idle" },
      { name: "agree", label: "Agree" },
      { name: "headShake", label: "Head Shake" },
      { name: "sad_pose", label: "Sad" },
      { name: "sneak_pose", label: "Sneak" },
    ],
  },
  {
    file: "Soldier.glb",
    label: "Soldier",
    scale: 0.55,
    animations: [
      { name: "Walk", label: "Walk" },
      { name: "Run", label: "Run" },
      { name: "Idle", label: "Idle" },
    ],
  },
  {
    file: "Michelle.glb",
    label: "Michelle (Mixamo)",
    scale: 0.55,
    animations: [], // will auto-detect
  },
];

// Preload all models
const MODEL_URLS = MODELS.map((m) => staticFile(`models/${m.file}`));
MODEL_URLS.forEach((url) => useGLTF.preload(url));

// ── Meta ────────────────────────────────────────────────────────────────────
export const showcaseRobotMeta = {
  id: "ShowcaseRobotEmotions",
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 300,
};

// ── Single model instance playing an animation ─────────────────────────────
const ModelInstance: React.FC<{
  modelUrl: string;
  animationName: string;
  scale: number;
  position: [number, number, number];
  frame: number;
  fps: number;
  color?: string;
}> = ({ modelUrl, animationName, scale, position, frame, fps, color }) => {
  const gltf = useGLTF(modelUrl);

  const { cloned, mixer } = useMemo(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
    if (color) {
      const tint = new THREE.Color(color);
      c.traverse((node: THREE.Object3D) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          const newMats = mats.map((m) => {
            const nm = (m as THREE.MeshStandardMaterial).clone();
            nm.color.lerp(tint, 0.4);
            return nm;
          });
          mesh.material = newMats.length === 1 ? newMats[0] : newMats;
        }
      });
    }
    return { cloned: c, mixer: new THREE.AnimationMixer(c) };
  }, [gltf.scene, color]);

  // Play the requested animation, or first available
  useMemo(() => {
    mixer.stopAllAction();
    const clip =
      gltf.animations.find((a) => a.name === animationName) ||
      gltf.animations[0];
    if (clip) mixer.clipAction(clip).play();
  }, [animationName, mixer, gltf.animations]);

  mixer.setTime(frame / fps);

  return (
    <group position={position} scale={[scale, scale, scale]}>
      <primitive object={cloned} />
    </group>
  );
};

// ── Auto-detecting model: shows first animation found ──────────────────────
const AutoModelInstance: React.FC<{
  modelUrl: string;
  animIndex: number;
  scale: number;
  position: [number, number, number];
  frame: number;
  fps: number;
}> = ({ modelUrl, animIndex, scale, position, frame, fps }) => {
  const gltf = useGLTF(modelUrl);

  const { cloned, mixer } = useMemo(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
    const mixer = new THREE.AnimationMixer(c);
    const idx = Math.min(animIndex, gltf.animations.length - 1);
    const clip = gltf.animations[idx] || gltf.animations[0];
    if (clip) mixer.clipAction(clip).play();
    return { cloned: c, mixer };
  }, [gltf.scene, animIndex, gltf.animations]);

  mixer.setTime(frame / fps);

  return (
    <group position={position} scale={[scale, scale, scale]}>
      <primitive object={cloned} />
    </group>
  );
};

// ── Floating label ──────────────────────────────────────────────────────────
const FloatingLabel: React.FC<{
  position: [number, number, number];
  text: string;
  color?: string;
  fontSize?: number;
}> = ({ position, text, color = "#FFFFFF", fontSize = 22 }) => {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 512, 64);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(4, 4, 504, 56, 14);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 34);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, color, fontSize]);

  return (
    <mesh position={position}>
      <planeGeometry args={[1.8, 0.23]} />
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
    </mesh>
  );
};

// ── Ground disc ─────────────────────────────────────────────────────────────
const GroundDisc: React.FC<{
  position: [number, number, number];
  color: string;
  radius?: number;
}> = ({ position, color, radius = 0.6 }) => (
  <mesh
    position={[position[0], 0.01, position[2]]}
    rotation={[-Math.PI / 2, 0, 0]}
  >
    <circleGeometry args={[radius, 24]} />
    <meshStandardMaterial
      color={color}
      transparent
      opacity={0.12}
      roughness={0.8}
    />
  </mesh>
);

// ── Camera ──────────────────────────────────────────────────────────────────
const CameraController: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const t = frame / 300;

  // Cycle through each model section
  const totalModels = MODELS.length;
  const sectionDuration = 1 / totalModels;
  const currentSection = Math.floor(t / sectionDuration);
  const sectionT = (t % sectionDuration) / sectionDuration;

  // Position for each model section (spread along X)
  const sectionSpacing = 8;
  const baseX = currentSection * sectionSpacing;
  const smoothX = baseX + sectionT * 0.5; // gentle drift within section

  // Slow sweep with smooth transitions
  const cameraX = smoothX + Math.sin(sectionT * Math.PI) * 1.5;
  const cameraY = 2.8 + Math.sin(t * Math.PI * 6) * 0.2;
  const cameraZ = 5.5 + Math.cos(t * Math.PI * 4) * 0.3;

  camera.position.set(cameraX, cameraY, cameraZ);
  target.set(baseX + 2, 0.7, -0.5);
  camera.lookAt(target);

  return null;
};

// ── Model colors for variety ────────────────────────────────────────────────
const ANIM_COLORS = [
  "#6366F1", "#22D3EE", "#10B981", "#EC4899",
  "#F59E0B", "#8B5CF6", "#06B6D4", "#EF4444",
];

// ── Main scene ──────────────────────────────────────────────────────────────
const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <>
      <CameraController frame={frame} />

      {/* Lighting */}
      <ambientLight color="#E8F0F8" intensity={0.65} />
      <directionalLight position={[5, 10, 5]} intensity={0.7} color="#FFFFFF" />
      <directionalLight
        position={[-3, 8, -3]}
        intensity={0.3}
        color="#D0E8FF"
      />
      <hemisphereLight args={["#E8F4FF", "#C0D8E8", 0.4]} />

      {/* Ground plane */}
      <mesh position={[16, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 20]} />
        <meshStandardMaterial color="#C8D8E8" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Render each model section */}
      {MODELS.map((model, modelIdx) => {
        const sectionX = modelIdx * 8;
        const modelUrl = MODEL_URLS[modelIdx];

        // Determine animations to show
        const anims =
          model.animations.length > 0
            ? model.animations
            : Array.from({ length: 4 }, (_, i) => ({
                name: `auto_${i}`,
                label: `Anim ${i + 1}`,
              }));

        const spacing = 1.6;
        const cols = Math.min(anims.length, 4);

        return (
          <React.Fragment key={model.file}>
            {/* Model title label */}
            <FloatingLabel
              position={[sectionX + ((cols - 1) * spacing) / 2, 2.2, 0.5]}
              text={model.label}
              color="#FFFFFF"
              fontSize={26}
            />

            {/* Individual animation instances */}
            {anims.map((anim, animIdx) => {
              const col = animIdx % cols;
              const row = Math.floor(animIdx / cols);
              const x = sectionX + col * spacing;
              const z = -row * 2.2;
              const color = ANIM_COLORS[animIdx % ANIM_COLORS.length];

              return (
                <React.Fragment key={anim.name}>
                  {model.animations.length > 0 ? (
                    <ModelInstance
                      modelUrl={modelUrl}
                      animationName={anim.name}
                      scale={model.scale}
                      position={[x, model.yOffset ?? 0, z]}
                      frame={frame}
                      fps={30}
                      color={color}
                    />
                  ) : (
                    <AutoModelInstance
                      modelUrl={modelUrl}
                      animIndex={animIdx}
                      scale={model.scale}
                      position={[x, model.yOffset ?? 0, z]}
                      frame={frame}
                      fps={30}
                    />
                  )}
                  <FloatingLabel
                    position={[x, 1.7, z]}
                    text={anim.label}
                    color={color}
                  />
                  <GroundDisc position={[x, 0, z]} color={color} />
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ── Composition ─────────────────────────────────────────────────────────────
export const ShowcaseRobotEmotions: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#D8EBF5" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 50, near: 0.1, far: 80, position: [0, 2.8, 5.5] }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.3,
        }}
        style={{ background: "#D8EBF5" }}
      >
        <Suspense fallback={null}>
          <Scene frame={frame} />
        </Suspense>
      </ThreeCanvas>

      {/* Title overlay */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "IBM Plex Sans, sans-serif",
          fontSize: 32,
          fontWeight: 700,
          color: "#1E293B",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        GLB Character Models Showcase
      </div>

      {/* Bottom legend */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "IBM Plex Sans, sans-serif",
          fontSize: 16,
          color: "#64748B",
        }}
      >
        Camera auto-pans through each model section — 4 models, {MODELS.reduce((acc, m) => acc + Math.max(m.animations.length, 4), 0)} animations total
      </div>
    </AbsoluteFill>
  );
};
