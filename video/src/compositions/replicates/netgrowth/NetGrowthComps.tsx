import React from "react";
import {
  AbsoluteFill,
  Img,
  Loop,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { NetGrowthScene, type SceneTheme } from "./NetGrowthScene";
import { NETGROWTH_COPY, COLORS } from "./data";
import { CRX_COPY, CRX_COLORS } from "./crx-data";
import { CASLON, HELVETICA } from "./fonts";
import { DIATYPE } from "../anoma/diatype";

// netgrowth lane barrel — RootReplicas.tsx imports ONLY this file.
// Ref: public/netgrowth-original.mp4 (1080×1080, 25fps, 709f, 28.36s):
// the CLSNet netted-value-YoY stat loop, one choreography run three
// times. Scene + measured tables live behind this barrel.

const FPS = 25;
const DURATION = 709;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ─── Background: the drifting arc-line field, mounted as a crossfade
// chain of plates every 8 frames (arc drift decorrelates fast: an
// 8-frame-spaced blend holds SSIM ≈0.98 in the busiest corner, 24-frame
// drops to 0.77 — measured). Mid-cycle plates have their content boxes
// patched from the clean cycle-boundary anchors; those patches sit
// under the replica's own ink, so only true-background pixels show.
const PLATE_STOPS: number[] = [...Array.from({ length: 89 }, (_, i) => i * 8), 708];

const plateName = (f: number) => `netgrowth-assets/plate-${String(f).padStart(3, "0")}.png`;

const Plates: React.FC<{ frame: number }> = ({ frame }) => {
  let i = 0;
  while (i < PLATE_STOPS.length - 2 && frame >= PLATE_STOPS[i + 1]) i++;
  const f0 = PLATE_STOPS[i];
  const f1 = PLATE_STOPS[i + 1];
  const t = interpolate(frame, [f0, f1], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Img
        src={staticFile(plateName(f0))}
        style={{ position: "absolute", width: 1080, height: 1080 }}
      />
      {t > 0 && (
        <Img
          src={staticFile(plateName(f1))}
          style={{ position: "absolute", width: 1080, height: 1080, opacity: t }}
        />
      )}
    </AbsoluteFill>
  );
};

// ─── Themes ───
const CLS_THEME: SceneTheme = {
  serifFamily: CASLON,
  sansFamily: HELVETICA,
  serifWeight: "400",
  sansWeight: "400",
  boldWeight: "700",
  digitWeight: "500",
  serifCapOffset: 0.16, // calibrated against reference stills
  sansCapOffset: 0.156,
  copy: NETGROWTH_COPY,
  colors: COLORS,
};

// ─── 1. The 1:1 replica (scored comp) ───
const NetGrowthReplicate: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Plates frame={frame} />
      <NetGrowthScene frame={frame} theme={CLS_THEME} />
    </AbsoluteFill>
  );
};

// ─── 2. Ref | replica, for eyeball gates ───
const NetGrowthSideBySide: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000", flexDirection: "row" }}>
    <div style={{ position: "relative", width: 1080, height: 1080 }}>
      <OffthreadVideo muted src={staticFile("netgrowth-original.mp4")} />
    </div>
    <div style={{ position: "relative", width: 1080, height: 1080 }}>
      <NetGrowthReplicate />
    </div>
  </AbsoluteFill>
);

// ─── 3. CrxGrowthLoop — the publishable CRX cut ───
// Identical motion grammar; Diatype (the dev.crxfx.com face) wears the
// whole frame; the CLS arc plates are replaced by the CRX water — the
// bridge hero wave, darkened under a navy scrim so the ink commands.
const CRX_THEME: SceneTheme = {
  serifFamily: DIATYPE,
  sansFamily: DIATYPE,
  serifWeight: "700",
  sansWeight: "400",
  boldWeight: "700",
  digitWeight: "700",
  serifCapOffset: 0.14,
  sansCapOffset: 0.14,
  copy: CRX_COPY,
  colors: {
    ...COLORS,
    bg: CRX_COLORS.bg,
    ink: CRX_COLORS.ink,
    label: CRX_COLORS.label,
    track: CRX_COLORS.track,
    footnote: CRX_COLORS.footnote,
    divider: CRX_COLORS.divider,
  },
};

const WAVE_SECONDS = 18;

const CrxWave: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: CRX_COLORS.bg }}>
    <Loop durationInFrames={WAVE_SECONDS * FPS}>
      <OffthreadVideo
        muted
        src={staticFile("crx-assets/bridge-wave.mp4")}
        style={{ width: 1080, height: 1080, objectFit: "cover" }}
      />
    </Loop>
    {/* Navy scrim: the water stays present, the ink stays sovereign. */}
    <AbsoluteFill style={{ backgroundColor: "rgba(8, 12, 26, 0.82)" }} />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 130% 110% at 50% 40%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.28) 100%)",
      }}
    />
  </AbsoluteFill>
);

const CrxGrowthLoop: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: CRX_COLORS.bg }}>
      <CrxWave />
      <NetGrowthScene frame={frame} theme={CRX_THEME} />
    </AbsoluteFill>
  );
};

export const netGrowthReplicateMeta = {
  id: "NetGrowth-Replicate",
  component: NetGrowthReplicate,
  durationInFrames: DURATION,
  fps: FPS,
  width: 1080,
  height: 1080,
};

export const netGrowthSideBySideMeta = {
  id: "NetGrowth-SideBySide",
  component: NetGrowthSideBySide,
  durationInFrames: DURATION,
  fps: FPS,
  width: 2160,
  height: 1080,
};

export const crxGrowthLoopMeta = {
  id: "CrxGrowthLoop",
  component: CrxGrowthLoop,
  durationInFrames: DURATION,
  fps: FPS,
  width: 1080,
  height: 1080,
};
