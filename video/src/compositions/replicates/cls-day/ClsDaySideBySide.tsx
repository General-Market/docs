// ClsDay-SideBySide — reference | replica, for eyeball gates.
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { ClsDayReplicate } from "./ClsDayReplicate";

export const ClsDaySideBySide: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", flexDirection: "row" }}>
    <div style={{ width: 1920, height: 1080, position: "relative" }}>
      <OffthreadVideo src={staticFile("cls-day-original.mp4")} muted />
    </div>
    <div style={{ width: 1920, height: 1080, position: "relative" }}>
      <ClsDayReplicate />
    </div>
  </AbsoluteFill>
);
