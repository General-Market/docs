import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";
import {
  baseText,
  GREEN,
  LightBg,
  sceneFade,
} from "../shared";

const TOTAL_NODES = 12;
const GREEN_NODES = 10;
const NODE_SIZE = 44;
const LINE_Y = 560;
const LINE_THICKNESS = 4;
const GRAY = "#C8C8C8";

const Checkmark: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ display: "block" }}
  >
    <path
      d="M6 12.5L10 16.5L18 8.5"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Scene16_49Games: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, 180);

  // --- Text animation ---
  // "Predicted the first 49 games" fades in first
  const titleOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 18], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "perfectly" arrives later, after most nodes are placed
  const perfectlyDelay = 90;
  const perfectlyOp = interpolate(
    frame,
    [perfectlyDelay, perfectlyDelay + 14],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const perfectlyY = interpolate(
    frame,
    [perfectlyDelay, perfectlyDelay + 14],
    [20, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // --- Timeline layout ---
  const padX = 40;
  const lineLeft = padX;
  const lineRight = 1920 - padX;
  const totalLineW = lineRight - lineLeft;

  // Node positions: evenly spaced across the line
  const nodePositions = Array.from({ length: TOTAL_NODES }, (_, i) => {
    const t = i / (TOTAL_NODES - 1);
    return lineLeft + t * totalLineW;
  });

  // --- Line draw animation ---
  // Line grows from left to right, starting at frame 15
  const lineStart = 15;
  const lineDur = 100;
  const lineProgress = interpolate(frame, [lineStart, lineStart + lineDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineEndX = lineLeft + lineProgress * totalLineW;

  // Green portion ends at the last green node position
  const greenEndX = nodePositions[GREEN_NODES - 1];

  // --- Node entrance ---
  // Each node pops in sequentially as the line reaches it
  const nodeSpring = (index: number) => {
    const nodeX = nodePositions[index];
    // When does the line reach this node?
    const arrivalT = (nodeX - lineLeft) / totalLineW;
    const arrivalFrame = lineStart + arrivalT * lineDur;

    return spring({
      frame: frame - arrivalFrame,
      fps,
      from: 0,
      to: 1,
      config: { damping: 10, stiffness: 160, mass: 0.8 },
    });
  };

  // Checkmark appears slightly after the node circle
  const checkDelay = 6;
  const checkOpacity = (index: number) => {
    const nodeX = nodePositions[index];
    const arrivalT = (nodeX - lineLeft) / totalLineW;
    const arrivalFrame = lineStart + arrivalT * lineDur + checkDelay;
    return interpolate(frame, [arrivalFrame, arrivalFrame + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 340,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "baseline",
          gap: 16,
        }}
      >
        <div
          style={{
            ...baseText,
            fontSize: 52,
            fontWeight: 700,
            transform: `translateY(${titleY}px)`,
            opacity: titleOp,
          }}
        >
          Predicted the first 49 games
        </div>
        <div
          style={{
            ...baseText,
            fontSize: 52,
            fontWeight: 700,
            transform: `translateY(${perfectlyY}px)`,
            opacity: perfectlyOp,
          }}
        >
          perfectly
        </div>
      </div>

      {/* Timeline line */}
      <div
        style={{
          position: "absolute",
          top: LINE_Y - LINE_THICKNESS / 2,
          left: lineLeft,
          height: LINE_THICKNESS,
          borderRadius: LINE_THICKNESS / 2,
          overflow: "hidden",
          width: Math.max(0, lineEndX - lineLeft),
        }}
      >
        {/* Green portion */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: Math.min(greenEndX - lineLeft, lineEndX - lineLeft),
            backgroundColor: GREEN,
          }}
        />
        {/* Gray portion (beyond last green node) */}
        {lineEndX > greenEndX && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: greenEndX - lineLeft,
              height: "100%",
              width: lineEndX - greenEndX,
              backgroundColor: GRAY,
            }}
          />
        )}
      </div>

      {/* Nodes */}
      {nodePositions.map((x, i) => {
        const isGreen = i < GREEN_NODES;
        const scale = nodeSpring(i);
        const visible = lineEndX >= x - NODE_SIZE / 2;

        if (!visible) return null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - NODE_SIZE / 2,
              top: LINE_Y - NODE_SIZE / 2,
              width: NODE_SIZE,
              height: NODE_SIZE,
              borderRadius: "50%",
              transform: `scale(${scale})`,
              backgroundColor: isGreen ? GREEN : "transparent",
              border: isGreen ? "none" : `3px solid ${GRAY}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
          >
            {isGreen && (
              <div style={{ opacity: checkOpacity(i) }}>
                <Checkmark size={24} color="#fff" />
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
