import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { EmberComposition, emberMeta } from "./EmberComposition";

export const EmberSideBySide: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    {/* Left: original video */}
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }}>
      <OffthreadVideo
        src={staticFile("ember-original.mp4")}
        style={{ width: 1920, height: 1080, objectFit: "contain" }}
      />
      <div style={{
        position: "absolute", top: 20, left: 20,
        color: "#D4978E",
        fontFamily: "'Inter', sans-serif",
        fontSize: 18, fontWeight: 700,
        padding: "6px 14px",
        background: "rgba(0,0,0,0.6)",
        borderRadius: 6,
      }}>
        ORIGINAL
      </div>
    </div>

    {/* Center divider */}
    <div style={{
      position: "absolute", left: 1919, top: 0,
      width: 2, height: 1080,
      background: "#D4978E", zIndex: 10,
    }} />

    {/* Right: replica */}
    <div style={{ position: "absolute", left: 1920, top: 0, width: 1920, height: 1080 }}>
      <EmberComposition />
      <div style={{
        position: "absolute", top: 20, right: 20,
        color: "#D4978E",
        fontFamily: "'Inter', sans-serif",
        fontSize: 18, fontWeight: 700,
        padding: "6px 14px",
        background: "rgba(0,0,0,0.6)",
        borderRadius: 6,
      }}>
        REMOTION
      </div>
    </div>
  </AbsoluteFill>
);

export const emberSideBySideMeta = {
  id: "Ember-SideBySide",
  component: EmberSideBySide,
  durationInFrames: emberMeta.durationInFrames,
  fps: emberMeta.fps,
  width: 3840,
  height: 1080,
};
