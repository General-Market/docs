// Source: https://github.com/andrewwoan/mr-pandas-psychologically-safe-portfolio
// Camera flies a CatmullRom curve through 4 paper-craft scenes.
// All values verified against source curve.jsx, Scene.jsx, Experience.jsx.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

// ── Asset paths ───────────────────────────────────────────────────────

const M = (name: string) => staticFile(`panda-portfolio/models/${name}`);

const MODELS = {
  scene1: M("scene_1.glb"),
  scene1Bg: M("scene_1_bg.glb"),
  scene2: M("scene_2.glb"),
  scene3: M("scene_3.glb"),
  scene4: M("scene_4.glb"),
  extras: M("Moving_Extras.glb"),
  panda: M("Panda.glb"),
  sheet: M("single_sheet.glb"),
  waterfall: M("not_waterfall.glb"),
};

Object.values(MODELS).forEach((url) => useGLTF.preload(url));

// ── Texture paths ─────────────────────────────────────────────────────

const T = (name: string) => staticFile(`panda-portfolio/textures/${name}`);
const BASIS_PATH = staticFile("panda-portfolio/basis") + "/";

const TEXTURES = {
  scene1: T("scene_1.ktx2"),
  scene1Bg: T("scene_1_bg.ktx2"),
  scene2: T("scene_2.ktx2"),
  scene3: T("scene_3.ktx2"),
  scene4: T("scene_4.ktx2"),
  extras: T("Moving_extras.ktx2"),
  waterfall: T("not_waterfall.ktx2"),
  sheet: T("single_sheet.ktx2"),
  pandaRegular: T("regular.ktx2"),
  pandaSamurai: T("samurai.ktx2"),
  pandaPirate: T("pirate.ktx2"),
  pandaDesert: T("desert.ktx2"),
  pandaZombie: T("zombie.ktx2"),
};

// ── KTX2 material hook — from source ktxLoader.jsx ────────────────────

function useKTX2Mat(
  url: string,
  transparent = true,
  alphaTest = 0.6,
  side: THREE.Side = THREE.FrontSide,
): THREE.MeshBasicMaterial {
  const gl = useThree((s) => s.gl);
  const texture = useLoader(KTX2Loader, url, (loader) => {
    (loader as KTX2Loader).setTranscoderPath(BASIS_PATH);
    (loader as KTX2Loader).detectSupport(gl);
  });

  return useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture as THREE.Texture,
        transparent,
        alphaTest,
        side,
      }),
    [texture, transparent, alphaTest, side],
  );
}

// ── Camera curve — 11 points from curve.jsx ───────────────────────────

const H_ADJ = 2; // heightYValueAdjustment

const CAM_POINTS = [
  new THREE.Vector3(-20.202141, -0.183518 + H_ADJ, 5),
  new THREE.Vector3(-15.8032, 0.336296 + H_ADJ, 8),
  new THREE.Vector3(-11.971144, 1.203873 + H_ADJ, 9),
  new THREE.Vector3(-4.681061, 2.775572 + H_ADJ, 9),
  new THREE.Vector3(2.74859, 2.177679 + H_ADJ, 7.5),
  new THREE.Vector3(8.42627, 2.705159 + H_ADJ, 8),
  new THREE.Vector3(14.909897, 1.517222 + H_ADJ, 7.3),
  new THREE.Vector3(21.697693, 3.17222 + H_ADJ, 7.3),
  new THREE.Vector3(26.066216, 4.106054 + H_ADJ, 5),
  new THREE.Vector3(31.030914, 4.106054 + H_ADJ, 5),
  new THREE.Vector3(36.005978, 3.91222 + H_ADJ, 5),
];

const CAM_CURVE = new THREE.CatmullRomCurve3(CAM_POINTS, false, "centripetal");

// ── Rotation keyframes — from curve.jsx rotationTargets ───────────────

const ROT_KEYS = [
  { p: 0, e: [-0.0017043241744864842, -0.22064811124855913, -0.0003730122560727475] },
  { p: 0.1445, e: [-0.06419977307905109, -0.08888115648279392, -0.00570642026054557] },
  { p: 0.3229, e: [-0.229101220729035, -0.027356265132564273, -0.006378475999996003] },
  { p: 0.3995, e: [-0.21490963788572381, 0.07946656300948479, 0.01732601995022464] },
  { p: 0.425, e: [-0.15971723485809433, 0.04670528046769929, 0.007520846163953575] },
  { p: 0.493, e: [-0.15103232459264546, 0.00498848150386255, 0.0007592001306001002] },
  { p: 0.5355, e: [-0.024867780069863777, -0.023369051346196712, -0.0005812032825821626] },
  { p: 0.6, e: [0.045197053301981635, -0.006583935578690767, 0.0002977751186144598] },
  { p: 0.6629, e: [-0.09476188265977611, 0.12518540275964718, 0.011866830817320508] },
  { p: 0.7195, e: [-0.03936093252874196, -0.09166906996940853, -0.0036049751059469247] },
  { p: 0.8129, e: [-0.07474327166814804, 0.051576095684842276, 0.003860429637009773] },
  { p: 1, e: [-0.07474327166814804, 0.051576095684842276, 0.003860429637009773] },
].map(({ p, e }) => ({
  progress: p,
  quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2])),
}));

function slerpRotation(progress: number): THREE.Quaternion {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= ROT_KEYS[0].progress) return ROT_KEYS[0].quat.clone();
  if (p >= ROT_KEYS[ROT_KEYS.length - 1].progress) return ROT_KEYS[ROT_KEYS.length - 1].quat.clone();

  let i = 0;
  while (i < ROT_KEYS.length - 1 && ROT_KEYS[i + 1].progress < p) i++;

  const a = ROT_KEYS[i];
  const b = ROT_KEYS[i + 1];
  const t = (p - a.progress) / (b.progress - a.progress);
  return new THREE.Quaternion().slerpQuaternions(a.quat, b.quat, t);
}

// ── Panda curve — from curve.jsx initialPandaPoints ───────────────────

const P_ADJ = -5.5; // pandaCurveHeightAdjustment

const PANDA_POINTS = [
  new THREE.Vector3(-20.50911, 0.790827 + P_ADJ, -1.341367),
  new THREE.Vector3(-15.077652, 0.790827 + P_ADJ, -1.398876),
  new THREE.Vector3(-9.425609, 0.790827 + P_ADJ, -1.341367),
  new THREE.Vector3(-3.599831, 0.731949 + P_ADJ, -1.398876),
  new THREE.Vector3(1.926874, 1.49733 + P_ADJ, -1.341367),
  new THREE.Vector3(7.588829, 2.235309 + P_ADJ, -1.387374),
  new THREE.Vector3(14.657124, 2.174377 + P_ADJ, -1.398991),
  new THREE.Vector3(21.697693, 2.423718 + P_ADJ, -1.416137),
  new THREE.Vector3(24.653442, 3.91255 + P_ADJ, -1.473646),
  new THREE.Vector3(31.030914, 4.092358 + P_ADJ + 1, -1.473646),
  new THREE.Vector3(36.005978, 4.092358 + P_ADJ + 1, -1.473646),
];

const PANDA_CURVE = new THREE.CatmullRomCurve3(PANDA_POINTS, false, "centripetal");

// ── Helpers ───────────────────────────────────────────────────────────

function remap(v: number, a: number, b: number, c: number, d: number): number {
  return c + Math.max(0, Math.min(1, (v - a) / (b - a))) * (d - c);
}

function applyMat(root: THREE.Object3D, mat: THREE.Material) {
  root.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      (c as THREE.Mesh).material = mat;
    }
  });
}

// ── Camera controller ─────────────────────────────────────────────────

const CameraCtrl: React.FC<{ progress: number; time: number }> = ({
  progress,
  time,
}) => {
  const { camera } = useThree();
  const p = Math.max(0, Math.min(1, progress));

  // Position from curve
  const pos = CAM_CURVE.getPointAt(p);

  // Gentle drift (replaces mouse parallax)
  camera.position.set(
    pos.x + Math.sin(time * 0.3) * 0.03,
    pos.y + Math.cos(time * 0.2) * 0.02,
    pos.z,
  );

  // Rotation via slerp
  camera.quaternion.copy(slerpRotation(p));

  const pc = camera as THREE.PerspectiveCamera;
  if (pc.fov !== 35) {
    pc.fov = 35;
    pc.updateProjectionMatrix();
  }

  return null;
};

// ── Static scene model with KTX2 texture ──────────────────────────────

const SceneGLB: React.FC<{ url: string; textureUrl: string }> = ({
  url,
  textureUrl,
}) => {
  const { scene } = useGLTF(url);
  const mat = useKTX2Mat(textureUrl);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    applyMat(c, mat);
    return c;
  }, [scene, mat]);

  return <primitive object={obj} />;
};

// ── Moving objects — from Moving_Objects.jsx ───────────────────────────
// Uses the actual node names from the GLB (verified via binary inspection):
// Bike_Body, Bike_Stick, Bike_Front_Wheel, Bike_Bake_Wheel, Bike_Pedal_Holder,
// Camel_Body, Camel_Stick, Ship_Stick, Skeleton_Stick, Actual_Plane

const MovingExtras: React.FC<{ progress: number; time: number }> = ({
  progress,
  time,
}) => {
  const { nodes } = useGLTF(MODELS.extras) as unknown as {
    nodes: Record<string, THREE.Mesh>;
  };

  const mat = useKTX2Mat(TEXTURES.extras);

  // Bike: progress [0, 0.3] → x from 0 to 16.89
  const bikeX = progress <= 0.3 ? remap(progress, 0, 0.3, 0, 16.89) : 16.89;
  const wheelRot = bikeX * -Math.PI * 2;
  const pedalRot = bikeX * Math.PI * 4;

  // Ship: progress [0.31, 0.49] → x 0→10, y 0→1.5
  const shipX =
    progress >= 0.31 && progress <= 0.49
      ? remap(progress, 0.31, 0.49, 0, 10)
      : progress > 0.49
        ? 10
        : 0;
  const shipY =
    progress >= 0.31 && progress <= 0.49
      ? remap(progress, 0.31, 0.49, 0, 1.5)
      : progress > 0.49
        ? 1.5
        : 0;

  // Camel: progress [0.508, 0.6] → x 0→6.5
  const camelX =
    progress >= 0.508 && progress <= 0.6
      ? remap(progress, 0.508, 0.6, 0, 6.5)
      : progress > 0.6
        ? 6.5
        : 0;
  const camelLegFreq = 3;
  const camelLegMax = THREE.MathUtils.degToRad(35);
  const camelNorm =
    progress >= 0.508 && progress <= 0.6
      ? remap(progress, 0.508, 0.6, 0, 1)
      : 0;
  const camelRightLeg =
    Math.sin(camelNorm * Math.PI * 2 * camelLegFreq) * camelLegMax;
  const camelLeftLeg =
    Math.sin(camelNorm * Math.PI * 2 * camelLegFreq + Math.PI) * camelLegMax;

  // Skeleton: progress [0.609, 0.69] → x 0→6.3
  const skelX =
    progress >= 0.609 && progress <= 0.69
      ? remap(progress, 0.609, 0.69, 0, 6.3)
      : progress > 0.69
        ? 6.3
        : 0;

  // Plane: continuous float
  const planeY = 0.2 * Math.sin(time * 0.4) + 8.3;
  const planeRotY = 0.02 * Math.sin(time * 0.4);

  return (
    <group>
      {/* ── Bike group ── */}
      <group position={[bikeX, 0.15, -0.25]}>
        {nodes.Bike_Body && (
          <mesh
            geometry={nodes.Bike_Body.geometry}
            material={mat}
            position={[-20.607, 0.901, -1.391]}
            rotation={[-Math.PI / 2, 0, -Math.PI]}
          />
        )}
        {nodes.Bike_Stick && (
          <mesh
            geometry={nodes.Bike_Stick.geometry}
            material={mat}
            position={[-20.497, 0.378, -1.48]}
            rotation={[Math.PI, 0, Math.PI]}
            scale={[1.523, 1, 1.523]}
          />
        )}
        {nodes.Bike_Front_Wheel && (
          <mesh
            geometry={nodes.Bike_Front_Wheel.geometry}
            material={mat}
            position={[-19.978, 0.664, -1.395]}
            rotation={[Math.PI / 2, wheelRot, 0]}
          />
        )}
        {nodes.Bike_Bake_Wheel && (
          <mesh
            geometry={nodes.Bike_Bake_Wheel.geometry}
            material={mat}
            position={[-20.918, 0.666, -1.392]}
            rotation={[Math.PI / 2, wheelRot, 0]}
          />
        )}
        {nodes.Bike_Pedal_Holder && (
          <group
            position={[-20.535, 0.616, -1.381]}
            rotation={[-Math.PI / 2, pedalRot, -Math.PI]}
          >
            <mesh
              geometry={nodes.Bike_Pedal_Holder.geometry}
              material={mat}
            />
          </group>
        )}
      </group>

      {/* ── Ship group ── */}
      <group position={[shipX - 0.2, shipY, 0]}>
        {nodes.Ship_Stick && (
          <mesh
            geometry={nodes.Ship_Stick.geometry}
            material={mat}
            position={[-2.512, 0.41, -1.34]}
            rotation={[Math.PI, 0, Math.PI]}
            scale={[1.523, 1, 1.523]}
          />
        )}
      </group>

      {/* ── Camel group ── */}
      <group position={[camelX, 0, 0]}>
        {nodes.Camel_Body && (
          <mesh
            geometry={nodes.Camel_Body.geometry}
            material={mat}
            position={[8.226, 2.754, -1.394]}
            rotation={[Math.PI / 2, 0.013, 0]}
            scale={0.849}
          />
        )}
        {nodes.Camel_Stick && (
          <mesh
            geometry={nodes.Camel_Stick.geometry}
            material={mat}
            position={[8.138, 1.997, -1.48]}
            rotation={[Math.PI, 0, Math.PI]}
            scale={[1.523, 1, 1.523]}
          />
        )}
        {nodes.front_right_camel && (
          <mesh
            geometry={nodes.front_right_camel.geometry}
            material={mat}
            position={[8.434, 2.572, -1.392]}
            rotation={[Math.PI / 2, camelRightLeg, 0]}
          />
        )}
        {nodes.back_right_camel && (
          <mesh
            geometry={nodes.back_right_camel.geometry}
            material={mat}
            position={[7.97, 2.547, -1.392]}
            rotation={[Math.PI / 2, camelRightLeg, 0]}
          />
        )}
        {nodes.front_left_camel && (
          <mesh
            geometry={nodes.front_left_camel.geometry}
            material={mat}
            position={[8.392, 2.703, -1.426]}
            rotation={[Math.PI / 2, camelLeftLeg, 0]}
          />
        )}
        {nodes.back_left_camel && (
          <mesh
            geometry={nodes.back_left_camel.geometry}
            material={mat}
            position={[7.97, 2.609, -1.426]}
            rotation={[Math.PI / 2, camelLeftLeg, 0]}
          />
        )}
      </group>

      {/* ── Skeleton group ── */}
      <group position={[skelX - 0.2, 0, 0]}>
        {nodes.Skeleton_Stick && (
          <mesh
            geometry={nodes.Skeleton_Stick.geometry}
            material={mat}
            position={[15.013, 1.303, -1.34]}
            rotation={[Math.PI, 0, Math.PI]}
            scale={[1.523, 1, 1.523]}
          />
        )}
      </group>

      {/* ── Plane (airplane) ── */}
      {nodes.Actual_Plane && (
        <mesh
          geometry={nodes.Actual_Plane.geometry}
          material={mat}
          position={[-20.812, planeY, -1.406]}
          rotation={[Math.PI / 2, -0.029, planeRotY]}
        />
      )}
    </group>
  );
};

// ── Panda character — from Panda.jsx ──────────────────────────────────

// Panda loads all 5 costume textures; selects based on progress
const PANDA_THRESHOLDS = [0, 0.136, 0.306, 0.501, 0.603, 0.705];

const PandaChar: React.FC<{ progress: number; time: number }> = ({
  progress,
  time,
}) => {
  const { nodes } = useGLTF(MODELS.panda) as unknown as {
    nodes: Record<string, THREE.Mesh>;
  };

  // Load all 5 costume KTX2 textures
  const regular = useKTX2Mat(TEXTURES.pandaRegular);
  const samurai = useKTX2Mat(TEXTURES.pandaSamurai);
  const pirate = useKTX2Mat(TEXTURES.pandaPirate);
  const desert = useKTX2Mat(TEXTURES.pandaDesert);
  const zombie = useKTX2Mat(TEXTURES.pandaZombie);

  const costumes = useMemo(
    () => [regular, samurai, pirate, desert, zombie, regular],
    [regular, samurai, pirate, desert, zombie],
  );

  const p = Math.max(0, Math.min(1, progress));
  const pos = PANDA_CURVE.getPointAt(p);

  // Bobbing — from Panda.jsx randomOffset
  const bobX = Math.sin(time * 1.8 + 0.5) * 0.05 * 0.3;
  const bobY = Math.sin(time * 1.8 + 1.2) * 0.05 * 0.3 - 0.4;

  // Pick costume by progress threshold
  let costumeIdx = 0;
  for (let i = PANDA_THRESHOLDS.length - 1; i >= 0; i--) {
    if (p >= PANDA_THRESHOLDS[i]) {
      costumeIdx = i;
      break;
    }
  }

  const pandaNode =
    nodes.Mr_Panda004 || nodes["Mr_Panda.004"] || nodes.Mr_Panda;

  if (!pandaNode) return null;

  return (
    <mesh
      geometry={pandaNode.geometry}
      material={costumes[costumeIdx]}
      position={[pos.x + bobX, pos.y + bobY, pos.z]}
      rotation={[Math.PI, 0, Math.PI]}
      scale={[1, 1, 1]}
    />
  );
};

// ── Scene 4 ghost — from SceneFour.jsx ────────────────────────────────

const Ghost: React.FC<{ time: number }> = ({ time }) => {
  const { nodes } = useGLTF(MODELS.scene4) as unknown as {
    nodes: Record<string, THREE.Mesh>;
  };
  const mat = useKTX2Mat(TEXTURES.scene4);

  const ghostNode = nodes.Ghost;
  if (!ghostNode) return null;

  const ghostY = ((time * 0.4) % 7.5) + 0.5;

  return (
    <mesh
      geometry={ghostNode.geometry}
      material={mat}
      position={[18.485, ghostY, -1.236]}
      rotation={[1.566, -0.053, -0.004]}
    />
  );
};

// ── Scene 2 ocean waves — from SceneTwo.jsx ───────────────────────────

const OceanWaves: React.FC<{ time: number }> = ({ time }) => {
  const { nodes } = useGLTF(MODELS.scene2) as unknown as {
    nodes: Record<string, THREE.Mesh>;
  };
  const mat = useKTX2Mat(TEXTURES.scene2);

  const oceanNode = nodes.Ocean_Water;
  if (!oceanNode) return null;

  const y1 = 0.24 * Math.sin(time + Math.PI / 4) + 1;
  const y2 = 0.2 * Math.sin(time) + 1.4;
  const y3 = 0.2 * Math.sin(time + Math.PI / 3) + 1.8;

  return (
    <group>
      <mesh
        geometry={oceanNode.geometry}
        material={mat}
        position={[-0.385, y1, -1.457]}
        rotation={[Math.PI / 2, 0.037, 0]}
      />
      <mesh
        geometry={oceanNode.geometry}
        material={mat}
        position={[2.8, y2, -1.457]}
        rotation={[Math.PI / 2, 0.037, 0]}
      />
      <mesh
        geometry={oceanNode.geometry}
        material={mat}
        position={[5.9, y3, -1.457]}
        rotation={[Math.PI / 2, 0.037, 0]}
      />
    </group>
  );
};

// ── Scene 2 dolphin — from SceneTwo.jsx ───────────────────────────────

const Dolphin: React.FC<{ time: number }> = ({ time }) => {
  const { nodes } = useGLTF(MODELS.scene2) as unknown as {
    nodes: Record<string, THREE.Mesh>;
  };
  const mat = useKTX2Mat(TEXTURES.scene2);

  const dolphinNode = nodes.Dolphin;
  if (!dolphinNode) return null;

  const dy = 1.5 * Math.sin(time * 2 + Math.PI / 3) + 2.3;
  const ry = 1.5 * Math.sin(time * 2);

  return (
    <mesh
      geometry={dolphinNode.geometry}
      material={mat}
      position={[5.608, dy, -1.252]}
      rotation={[Math.PI / 2, ry, 0]}
      scale={0.717}
    />
  );
};

// ── Scene 1 dragon — from SceneOne.jsx ────────────────────────────────

const DragonHead: React.FC<{ time: number }> = ({ time }) => {
  const { nodes } = useGLTF(MODELS.scene1) as unknown as {
    nodes: Record<string, THREE.Mesh>;
  };
  const mat = useKTX2Mat(TEXTURES.scene1);

  const headNode = nodes.Plane037;
  if (!headNode) return null;

  return (
    <mesh
      geometry={headNode.geometry}
      material={mat}
      position={[-5.243, 4.082, -2.267]}
      rotation={[Math.PI / 2, 0.2 * Math.sin(time * 0.8), 0]}
    />
  );
};

// ── Background gradient ───────────────────────────────────────────────

const BG_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

const BG_FRAG = `
  varying vec2 vUv;
  void main() {
    vec3 top = vec3(0.831, 0.910, 0.816);
    vec3 bot = vec3(0.961, 0.937, 0.878);
    gl_FragColor = vec4(mix(bot, top, vUv.y), 1.0);
  }
`;

const PaperBg: React.FC = () => (
  <mesh renderOrder={-1000}>
    <planeGeometry args={[2, 2]} />
    <shaderMaterial
      vertexShader={BG_VERT}
      fragmentShader={BG_FRAG}
      depthWrite={false}
      depthTest={false}
    />
  </mesh>
);

// ── Fog ───────────────────────────────────────────────────────────────

const Fog: React.FC = () => {
  const { scene } = useThree();
  useMemo(() => {
    scene.fog = new THREE.Fog("#e8e0d4", 8, 28);
  }, [scene]);
  return null;
};

// ── Main 3D scene ─────────────────────────────────────────────────────

const PandaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const progress = frame / durationInFrames;
  const time = frame / fps;

  return (
    <>
      <CameraCtrl progress={progress} time={time} />
      <Fog />
      <PaperBg />

      <ambientLight intensity={0.9} color="#ffe8d6" />
      <directionalLight position={[10, 15, 8]} intensity={0.6} />
      <directionalLight position={[-5, 10, -3]} intensity={0.3} color="#b4d4ff" />

      {/* Static scenes with KTX2 textures */}
      <SceneGLB url={MODELS.scene1Bg} textureUrl={TEXTURES.scene1Bg} />
      <SceneGLB url={MODELS.scene1} textureUrl={TEXTURES.scene1} />
      <SceneGLB url={MODELS.scene2} textureUrl={TEXTURES.scene2} />
      <SceneGLB url={MODELS.scene3} textureUrl={TEXTURES.scene3} />
      <SceneGLB url={MODELS.scene4} textureUrl={TEXTURES.scene4} />
      <SceneGLB url={MODELS.waterfall} textureUrl={TEXTURES.waterfall} />

      {/* Animated scene elements */}
      <DragonHead time={time} />
      <OceanWaves time={time} />
      <Dolphin time={time} />
      <Ghost time={time} />

      {/* Moving objects */}
      <MovingExtras progress={progress} time={time} />

      {/* Panda */}
      <PandaChar progress={progress} time={time} />
    </>
  );
};

// ── Composition ───────────────────────────────────────────────────────

export const PandaPortfolio: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#e8e0d4" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          position: [CAM_POINTS[0].x, CAM_POINTS[0].y, CAM_POINTS[0].z],
          fov: 35,
          near: 0.1,
          far: 100,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <React.Suspense fallback={null}>
          <PandaScene />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
