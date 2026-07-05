import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useIrswapAssets } from "./lib/assets";
import { EdgeFeather, Grain } from "./lib/post";
import { CameraRig, Room, Vignette } from "./lib/world";
import { A_TILT, T_BLD, T_C2, T_COMM, T_OUTRO, T_SLOT, worldCam } from "./lib/camera";
import { ChartRoomGround, ChartRoomOverlay, ChartRoomWorld } from "./scenes/ChartRoom";
import {
  BldSpinGroup, bldSpinAxisXZ, BuildingsOverlay, BuildingsWorld, camBld, FloorMap,
} from "./scenes/Buildings";
import { BuildingSlabs } from "./scenes/Buildings3D";
import { Chart2Overlay, Chart2World, FloorSet, whipSigma } from "./scenes/Chart2";
import { AdvDisOverlay } from "./scenes/AdvDis";
import { FloorPaper } from "./scenes/floorPaper";
import { SlotWorld } from "./scenes/Slot";
import { CommunityOverlay, CommunityWorld, SheetFloor } from "./scenes/Community";
import { OutroWorld } from "./scenes/Outro";

export const FPS = 25;
export const DURATION = 5433; // 217.32s — matches reference irswap-original.mp4 (25fps/5433f)

// ONE continuous scene: a single canvas, a single camera path (lib/camera.ts),
// zero Sequence elements anywhere — regions of the world mount/unmount by
// plain frame-range conditionals while the camera never resets. All scene
// code works in GLOBAL frames (their internal tables always did).
//
// Render windows (world content) — chosen so each boundary's element
// animations complete on screen:
//   chartRoom [0,1745)  — wall topples by 1685, floor fades under the
//                          buildings map through 1740
//   buildings [1705,3588) — floor map fades out 3572-3588 under Chart2's
//   chart2    [3572,4160) — floor set fades out 4133-4155 under FloorPaper
//   advDis    [4131,4263) → slot [4263,4690) — same region (T_SLOT)
//   community [4690,5290) — sheet floor dissolves 5262-5285, cube gone 5287
//   outro     [5276,5433]
const WIN = {
  chartRoom: [0, 1745],
  buildings: [1705, 3588],
  chart2: [3572, 4160],
  advDis: [4131, 4263],
  slot: [4263, 4690],
  community: [4690, 5290],
  outro: [5276, 5434],
} as const;

const on = (f: number, w: readonly [number, number]) => f >= w[0] && f < w[1];

// ── background sheet ─────────────────────────────────────────────
// The former per-scene Vignettes, crossfaded at the region boundaries
// (they are near-identical near-white fields; the fade is insurance, not
// spectacle).
const BG: { at: number; variant: "default" | "soft" | "room" }[] = [
  { at: 0, variant: "default" },
  { at: 1705, variant: "soft" },
  { at: 3572, variant: "default" },
  { at: 4131, variant: "room" },
  { at: 4690, variant: "default" },
];
const BG_FADE = 15;

// ── persistent ground layer ──────────────────────────────────────
// Mounted for ALL 5433 frames, never gated: the floor plane artwork of the
// whole video, each region at its fixed world transform. Pieces fade in
// place on their measured schedules (inside their own draw callbacks); the
// layer itself never unmounts and nothing on it translates. Actors (walls,
// buildings, charts, reel, cube, book) live in the windowed scene worlds.
const GroundWorld: React.FC<{ frame: number }> = ({ frame }) => {
  // r7 strike-3: the buildings-exit spin (Buildings.tsx BldSpinGroup)
  // turns the floor too — the chart paper (FloorSet) crossfades in under
  // the map at 3518-3544, rides the same rigid yaw about the cluster
  // axis, and lands on its own chart2 pose at the exact-360 closure
  // (f3574): identity at both ends, so every frame outside (3551, 3574)
  // renders the untouched tree. The axis is T_BLD-local; FloorSet lives
  // in T_C2, so the same world axis is re-expressed in its frame.
  const spinAxis = bldSpinAxisXZ(frame);
  const spinAxisC2: [number, number] = [
    T_BLD[0] + spinAxis[0] - T_C2[0],
    T_BLD[2] + spinAxis[1] - T_C2[2],
  ];
  return (
  <>
    <ChartRoomGround frame={frame} />
    <group position={T_BLD}>
      <BldSpinGroup frame={frame} axis={spinAxis}>
        <FloorMap frame={frame} />
        <BuildingSlabs frame={frame} g={camBld(frame).g} />
      </BldSpinGroup>
    </group>
    <group position={T_C2}>
      <BldSpinGroup frame={frame} axis={spinAxisC2}>
        <FloorSet frame={frame} />
      </BldSpinGroup>
    </group>
    <group position={T_SLOT}>
      <FloorPaper frame={frame} />
    </group>
    <group position={T_COMM} rotation={[A_TILT, 0, 0]}>
      <SheetFloor frame={frame} />
    </group>
  </>
  );
};

const WorldBackground: React.FC<{ frame: number }> = ({ frame }) => {
  let i = 0;
  for (let k = 0; k < BG.length; k++) if (frame >= BG[k].at) i = k;
  const t = i > 0 ? Math.min(1, (frame - BG[i].at) / BG_FADE) : 1;
  return (
    <>
      {t < 1 && <Vignette variant={BG[i - 1].variant} />}
      <Vignette variant={BG[i].variant} opacity={t} />
    </>
  );
};

// ── boundary-F luma hump ─────────────────────────────────────────
// Measured on the reference: full-frame mean rises from ~5256, peaks at
// +3.4 levels over baseline at 5286, and never approaches paper-white
// (the old stacked 0.62/0.9 washes were far too strong). Most of the rise
// comes from the content itself dissolving; this shallow wash supplies the
// remainder.
const HUMP: [number, number][] = [
  [5250, 0], [5262, 0.12], [5274, 0.24], [5286, 0.3], [5294, 0.16],
  [5300, 0.05], [5304, 0],
];
const humpAt = (f: number): number => {
  if (f <= HUMP[0][0] || f >= HUMP[HUMP.length - 1][0]) return 0;
  for (let i = 0; i < HUMP.length - 1; i++) {
    if (f <= HUMP[i + 1][0]) {
      const t = (f - HUMP[i][0]) / (HUMP[i + 1][0] - HUMP[i][0]);
      return HUMP[i][1] + (HUMP[i + 1][1] - HUMP[i][1]) * t;
    }
  }
  return 0;
};

const GRAIN_ON = true;
const FEATHER_ON = true;

export const IRSwapComposition: React.FC = () => {
  const frame = useCurrentFrame();
  // Fonts/images resolve at the DOM level BEFORE the canvas mounts — a
  // readiness flip inside the R3F tree does not repaint the GL frame.
  const ready = useIrswapAssets();
  const { pos, rotX, rotZ, rotY } = worldCam(frame);
  const [sigX, sigY] = whipSigma(frame);
  const blurred = sigX > 0.25 || sigY > 0.25;
  const hump = humpAt(frame);
  return (
    <AbsoluteFill style={{ backgroundColor: "#EFEFEF" }}>
      <WorldBackground frame={frame} />
      {blurred && (
        <svg width={0} height={0}>
          <filter id="irswap-whip-blur">
            <feGaussianBlur stdDeviation={`${sigX} ${sigY}`} />
          </filter>
        </svg>
      )}
      <AbsoluteFill style={{ filter: blurred ? "url(#irswap-whip-blur)" : undefined }}>
        {ready && (
        <Room>
          <CameraRig position={pos} rotX={rotX} rotY={rotY ?? 0} rotZ={rotZ} />
          <GroundWorld frame={frame} />
          {on(frame, WIN.chartRoom) && <ChartRoomWorld frame={frame} />}
          {on(frame, WIN.buildings) && (
            <group position={T_BLD}>
              <BuildingsWorld frame={frame} />
            </group>
          )}
          {on(frame, WIN.chart2) && (
            <group position={T_C2}>
              <Chart2World frame={frame} />
            </group>
          )}
          {on(frame, WIN.slot) && (
            <group position={T_SLOT}>
              <SlotWorld frame={frame} />
            </group>
          )}
          {on(frame, WIN.community) && (
            <group position={T_COMM} rotation={[A_TILT, 0, 0]}>
              <CommunityWorld frame={frame} />
            </group>
          )}
          {on(frame, WIN.outro) && (
            <group position={T_OUTRO} rotation={[A_TILT, 0, 0]}>
              <OutroWorld frame={frame} />
            </group>
          )}
        </Room>
        )}
      </AbsoluteFill>
      {frame < 1705 && <ChartRoomOverlay frame={frame} />}
      {on(frame, WIN.buildings) && <BuildingsOverlay frame={frame} />}
      {frame >= 3572 && frame < 4131 && <Chart2Overlay frame={frame} />}
      {/* AdvDis text finishes its measured in-place fade at 4266 */}
      {frame >= 4131 && frame < 4267 && <AdvDisOverlay frame={frame} />}
      {on(frame, WIN.community) && <CommunityOverlay frame={frame} />}
      {/* the outro cube-ghost SVG is retired: the community glass cube owns
          the fade (5280-5287) — two cubes 80px apart read as a defect */}
      {hump > 0 && <AbsoluteFill style={{ background: "#FBFBFA", opacity: hump }} />}
      {/* measured film response of the reference (see lib/post.tsx);
          grain freezes with the reference's static credits from 5317 */}
      {GRAIN_ON && <Grain frame={Math.min(frame, 5317)} />}
      {FEATHER_ON && <EdgeFeather />}
    </AbsoluteFill>
  );
};

export const irswapReplicateMeta = {
  id: "IRSwap-Replicate",
  component: IRSwapComposition,
  width: 854,
  height: 480,
  fps: FPS,
  durationInFrames: DURATION,
};
