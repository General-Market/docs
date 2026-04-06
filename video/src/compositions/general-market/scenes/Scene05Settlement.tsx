import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import * as THREE from "three";
import { THEME } from "../theme";
import { GMGrid } from "../components/GMGrid";
import { Counter } from "../components/Counter";

const { fontFamily } = loadFont();

const SceneLights: React.FC = () => (
  <>
    <pointLight
      color={0xffffff}
      intensity={8}
      decay={0}
      position={[0, 0, 5]}
    />
    <pointLight
      color={0x00c853}
      intensity={3}
      decay={0}
      position={[0, 0, -20]}
    />
    <ambientLight intensity={0.3} />
  </>
);

export const Scene05Settlement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Title spring entry from frame 5
  const titleSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.6 },
    durationInFrames: 20,
  });
  const titleY = interpolate(titleSpring, [0, 1], [-30, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Subtitle entry slightly delayed
  const subtitleSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.6 },
    durationInFrames: 20,
  });
  const subtitleY = interpolate(subtitleSpring, [0, 1], [-20, 0]);
  const subtitleOpacity = interpolate(subtitleSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bgDark,
        color: THEME.textLight,
        fontFamily,
      }}
    >
      {/* Three.js layer — both grids share one canvas */}
      <AbsoluteFill>
        <ThreeCanvas
          width={width}
          height={height}
          camera={{ position: [0, 0, 100], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          shadows
          style={{ width: "100%", height: "100%" }}
        >
          <SceneLights />
          {/* LEFT — slow ceremonial pulse, the old way */}
          <GMGrid
            cols={10}
            rows={8}
            fillRatio={1.0}
            activeColor={THEME.muted}
            inactiveColor={THEME.divider}
            pulseFreq={0.5}
            pulseAmplitude={0.4}
            position={[-35, 0, 0]}
            seed={1}
          />
          {/* RIGHT — rapid flicker, the new way */}
          <GMGrid
            cols={10}
            rows={8}
            fillRatio={1.0}
            activeColor={THEME.gmGreen}
            inactiveColor={THEME.divider}
            pulseFreq={12}
            pulseAmplitude={0.3}
            position={[35, 0, 0]}
            seed={2}
          />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          width: "100%",
          textAlign: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: THEME.textLight,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          30x faster to settle.
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          width: "100%",
          textAlign: "center",
          transform: `translateY(${subtitleY}px)`,
          opacity: subtitleOpacity,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: THEME.muted,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Because it&apos;s parimutuel.
        </div>
      </div>

      {/* LEFT counter — static "1 / week" */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          width: "50%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Counter
          target={1}
          durationFrames={1}
          startFrame={20}
          label="/ week"
          color={THEME.muted}
          fontSize={80}
          formatWithCommas={false}
        />
      </div>

      {/* RIGHT counter — ticks 0 to 144 / day */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: "50%",
          width: "50%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Counter
          target={144}
          durationFrames={100}
          startFrame={20}
          label="/ day"
          color={THEME.gmGreen}
          fontSize={80}
          formatWithCommas={false}
        />
      </div>
    </AbsoluteFill>
  );
};
