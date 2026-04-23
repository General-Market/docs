import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { OFFirst8, ofFirst8Meta } from "./OFFirst8";

/**
 * Overlay mode: original video at 50% opacity on top of the Remotion reproduction.
 * Where they match, the image is sharp. Where they differ, you see ghosting/doubling.
 * Toggle between OVERLAY and SIDE-BY-SIDE with the mode constant below.
 */

const MODE: "overlay" | "side-by-side" = "overlay";

const Overlay: React.FC = () => {
  const f = useCurrentFrame();
  // Pulse the original opacity so you can see both layers alternately
  // Hold shift in Remotion studio + scrub to compare frame by frame
  return (
    <AbsoluteFill style={{ backgroundColor: "#F0EDF6" }}>
      {/* Bottom layer: Remotion reproduction */}
      <AbsoluteFill>
        <OFFirst8 />
      </AbsoluteFill>

      {/* Top layer: original video at 50% opacity */}
      <AbsoluteFill style={{ opacity: 0.5, mixBlendMode: "multiply" }}>
        <OffthreadVideo
          src={staticFile("of-original.mp4")}
          style={{ width: 1280, height: 720, objectFit: "contain" }}
        />
      </AbsoluteFill>

      {/* Labels */}
      <div style={{
        position: "absolute", top: 12, left: 12,
        color: "#FFF",
        fontFamily: "'Inter', sans-serif",
        fontSize: 14, fontWeight: 700,
        padding: "4px 10px",
        background: "rgba(0,0,0,0.7)",
        borderRadius: 4,
      }}>
        OVERLAY — original 50% on top
      </div>
      <div style={{
        position: "absolute", bottom: 12, right: 12,
        color: "#FFF",
        fontFamily: "'Inter', sans-serif",
        fontSize: 12, fontWeight: 600,
        padding: "3px 8px",
        background: "rgba(0,0,0,0.5)",
        borderRadius: 4,
      }}>
        f{f}
      </div>
    </AbsoluteFill>
  );
};

const SideBySide: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 1280, height: 720 }}>
      <OffthreadVideo
        src={staticFile("of-original.mp4")}
        style={{ width: 1280, height: 720, objectFit: "contain" }}
      />
      <div style={{
        position: "absolute", top: 16, left: 16,
        color: "#8B6BD8", fontFamily: "'Inter', sans-serif",
        fontSize: 16, fontWeight: 700,
        padding: "5px 12px", background: "rgba(0,0,0,0.55)", borderRadius: 5,
      }}>ORIGINAL</div>
    </div>
    <div style={{ position: "absolute", left: 1279, top: 0, width: 2, height: 720, background: "#8B6BD8", zIndex: 10 }} />
    <div style={{ position: "absolute", left: 1280, top: 0, width: 1280, height: 720 }}>
      <OFFirst8 />
      <div style={{
        position: "absolute", top: 16, right: 16,
        color: "#8B6BD8", fontFamily: "'Inter', sans-serif",
        fontSize: 16, fontWeight: 700,
        padding: "5px 12px", background: "rgba(0,0,0,0.55)", borderRadius: 5,
      }}>REMOTION</div>
    </div>
  </AbsoluteFill>
);

const Comp = MODE === "overlay" ? Overlay : SideBySide;

export const OFFirst8SideBySide: React.FC = () => <Comp />;

export const ofFirst8SideBySideMeta = {
  id: "OFFirst8-SideBySide",
  component: OFFirst8SideBySide,
  durationInFrames: ofFirst8Meta.durationInFrames,
  fps: ofFirst8Meta.fps,
  width: MODE === "overlay" ? 1280 : 2560,
  height: 720,
};
