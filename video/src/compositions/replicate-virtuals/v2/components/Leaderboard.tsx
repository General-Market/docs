import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

interface LeaderboardProps {
  rowCount?: number;
  startFrame?: number;
  highlightTop?: number;
}

const MEDAL_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

export const Leaderboard: React.FC<LeaderboardProps> = ({
  rowCount = 5,
  startFrame = 0,
  highlightTop = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rows = Array.from({ length: rowCount }, (_, i) => ({
    rank: i + 1,
    name: `agent_${String(i + 1).padStart(2, "0")}`,
    pnl: `+${(98.7 - i * 11.3).toFixed(1)}%`,
    score: Math.round(9800 - i * 870),
  }));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "60px 200px",
      }}
    >
      {rows.map((row, i) => {
        const elapsed = frame - startFrame - i * 6;
        const s = spring({
          frame: Math.max(0, elapsed),
          fps,
          config: { damping: 18, stiffness: 100, mass: 0.7 },
          durationInFrames: 10,
        });
        const opacity = elapsed < 0 ? 0 : s;
        const translateX = elapsed < 0 ? 80 : 80 * (1 - s);
        const isTop = row.rank <= highlightTop;
        const dimming = isTop ? 1 : Math.max(0.3, 1 - (row.rank - highlightTop) * 0.15);

        return (
          <div
            key={row.rank}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              maxWidth: 900,
              height: 56,
              borderRadius: 28,
              backgroundColor: isTop
                ? "rgba(62,205,160,0.2)"
                : "rgba(255,255,255,0.06)",
              border: isTop
                ? "1.5px solid #3ECDA0"
                : "1px solid rgba(255,255,255,0.08)",
              padding: "0 24px",
              opacity: opacity * dimming,
              transform: `translateX(${translateX}px)`,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 18,
              color: isTop ? "#3ECDA0" : "#fff",
              gap: 16,
            }}
          >
            {MEDAL_COLORS[row.rank] ? (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: MEDAL_COLORS[row.rank],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#1a1a1a",
                  flexShrink: 0,
                }}
              >
                {row.rank}
              </div>
            ) : (
              <div
                style={{
                  width: 28,
                  textAlign: "center",
                  fontSize: 14,
                  color: "#666",
                  flexShrink: 0,
                }}
              >
                {row.rank}
              </div>
            )}
            <div style={{ flex: 1, fontWeight: 500 }}>{row.name}</div>
            <div style={{ fontWeight: 700, color: "#3ECDA0", minWidth: 90, textAlign: "right" }}>
              {row.pnl}
            </div>
            <div style={{ minWidth: 80, textAlign: "right", color: "#888", fontSize: 14 }}>
              {row.score} pts
            </div>
          </div>
        );
      })}
    </div>
  );
};
