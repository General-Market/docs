import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

type Props = {
  startFrame: number;
  durationFrames?: number;
  yPercent?: number;
};

export const AnamorphicStreak: React.FC<Props> = ({
  startFrame,
  durationFrames = 12,
  yPercent = 50,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames) return null;

  const t = local / durationFrames;

  const widthPct = interpolate(t, [0, 0.45, 1], [0, 130, 130], {
    easing: Easing.out(Easing.expo),
  });
  const heightPx = interpolate(t, [0, 0.4, 0.7, 1], [2, 38, 22, 2], {
    easing: Easing.inOut(Easing.cubic),
  });
  const coreOpacity = interpolate(t, [0, 0.3, 0.7, 1], [0, 1, 0.7, 0], {
    easing: Easing.inOut(Easing.cubic),
  });
  const glowSpread = interpolate(t, [0, 0.5, 1], [4, 80, 4]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: `${yPercent}%`,
          transform: "translate(-50%, -50%)",
          width: `${widthPct}%`,
          height: `${heightPx}px`,
          background:
            "linear-gradient(90deg, rgba(255,200,160,0) 0%, rgba(255,240,220,0.95) 30%, #fff 50%, rgba(255,240,220,0.95) 70%, rgba(255,200,160,0) 100%)",
          opacity: coreOpacity,
          boxShadow: `0 0 ${glowSpread}px ${glowSpread * 0.5}px rgba(255, 230, 200, ${coreOpacity * 0.8}), 0 0 ${glowSpread * 2}px ${glowSpread}px rgba(255, 180, 140, ${coreOpacity * 0.4})`,
          mixBlendMode: "screen",
          willChange: "width, height, opacity",
        }}
      />
    </div>
  );
};
