import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

const FPS = 30;
const DURATION = 9 * FPS;

// Accelerates hard, brakes only at the very end
const EASE_IN_BRAKE = Easing.bezier(0.5, 0, 0.15, 1);
const EASE_OUT_QUINT = Easing.bezier(0.22, 1, 0.36, 1);

const COLORS: Record<number, string> = {
  1: "#2D1B69",
  2: "#E8634A",
  3: "#1A73E8",
  4: "#C41E7A",
  5: "#3B82F6",
  6: "#F5E6D0",
  7: "#0D4B4A",
  8: "#E2E8F0",
  9: "#1B4332",
  10: "#065F46",
  11: "#7C3AED",
  12: "#0F172A",
};

const Placeholder: React.FC<{ num: number }> = ({ num }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      backgroundColor: COLORS[num] || "#333",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <span
      style={{
        fontSize: 72,
        fontWeight: 900,
        color: "rgba(255,255,255,0.85)",
        fontFamily: "system-ui, sans-serif",
        textShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      #{num}
    </span>
  </div>
);

// ═══════════════════════════════════════════
// RowStrip: conveyor-belt transition for one row.
//
// Renders [newPanels... | oldPanels...] in a flex row.
// Old panels all share the same width and compress together.
// New panels all share the same width and decompress together.
//
// progress: 0 = fully old, 1 = fully new.
// ═══════════════════════════════════════════
const RowStrip: React.FC<{
  oldPanels: React.ReactNode[];
  newPanels: React.ReactNode[];
  progress: number;
  height: string;
  gap?: number;
}> = ({ oldPanels, newPanels, progress, height, gap = 3 }) => {
  const oldCount = oldPanels.length;
  const newCount = newPanels.length;

  // Total available width = 100%
  // New panels share: progress * 100% total
  // Old panels share: (1 - progress) * 100% total
  const newTotalPct = progress * 100;
  const oldTotalPct = (1 - progress) * 100;

  const newEachPct = newCount > 0 ? newTotalPct / newCount : 0;
  const oldEachPct = oldCount > 0 ? oldTotalPct / oldCount : 0;

  // Content scaleX: proportional to how compressed the container is
  const newSx = Math.max(0.01, progress);
  const oldSx = Math.max(0.01, 1 - progress);

  return (
    <div
      style={{
        width: "100%",
        height,
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
        borderRadius: R,
        gap: progress > 0.01 && progress < 0.99 ? 0 : gap,
      }}
    >
      {/* New panels (entering from left) */}
      {newPanels.map((panel, i) => (
        <div
          key={`new-${i}`}
          style={{
            width: `${newEachPct}%`,
            height: "100%",
            overflow: "hidden",
            flexShrink: 0,
            borderRadius: progress > 0.95 ? 6 : 0,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              transform: `scaleX(${newSx})`,
              transformOrigin: "center",
            }}
          >
            {panel}
          </div>
        </div>
      ))}
      {/* Old panels (being pushed right + compressed) */}
      {oldPanels.map((panel, i) => (
        <div
          key={`old-${i}`}
          style={{
            width: `${oldEachPct}%`,
            height: "100%",
            overflow: "hidden",
            flexShrink: 0,
            borderRadius: progress < 0.05 ? 6 : 0,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              transform: `scaleX(${oldSx})`,
              transformOrigin: "center",
            }}
          >
            {panel}
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════
// ColStrip: vertical conveyor-belt transition.
//
// New content pushes DOWN from top, old compresses toward bottom.
// Uses scaleY instead of scaleX.
// ═══════════════════════════════════════════
const ColStrip: React.FC<{
  oldContent: React.ReactNode;
  newContent: React.ReactNode;
  progress: number;
}> = ({ oldContent, newContent, progress }) => {
  const newPct = progress * 100;
  const oldPct = (1 - progress) * 100;
  const newSy = Math.max(0.01, progress);
  const oldSy = Math.max(0.01, 1 - progress);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: R,
      }}
    >
      {newPct > 0.3 && (
        <div style={{ width: "100%", height: `${newPct}%`, overflow: "hidden", flexShrink: 0 }}>
          <div style={{ width: "100%", height: "100%", transform: `scaleY(${newSy})`, transformOrigin: "center top" }}>
            {newContent}
          </div>
        </div>
      )}
      {oldPct > 0.3 && (
        <div style={{ width: "100%", height: `${oldPct}%`, overflow: "hidden", flexShrink: 0 }}>
          <div style={{ width: "100%", height: "100%", transform: `scaleY(${oldSy})`, transformOrigin: "center bottom" }}>
            {oldContent}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-animations ───

const LineDrawing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0, 1.5 * fps], [0, 1], { extrapolateRight: "clamp", easing: EASE_OUT_QUINT });
  const d = interpolate(p, [0, 1], [300, 0]);
  return (
    <svg viewBox="0 0 200 200" style={{ position: "absolute", top: "50%", left: "50%", width: "60%", height: "60%", transform: "translate(-50%, -50%)" }}>
      <circle cx="100" cy="100" r="70" fill="none" stroke="#333" strokeWidth="2" strokeDasharray="440" strokeDashoffset={440 * (1 - p)} strokeLinecap="round" />
      <line x1="100" y1="20" x2="100" y2="180" stroke="#333" strokeWidth="2" strokeDasharray="160" strokeDashoffset={d} />
      <line x1="20" y1="100" x2="180" y2="100" stroke="#333" strokeWidth="2" strokeDasharray="160" strokeDashoffset={d} />
      <circle cx="100" cy="100" r="90" fill="none" stroke="#333" strokeWidth="1.5" strokeDasharray="8 6" strokeDashoffset={frame * 0.8} />
    </svg>
  );
};

const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.floor(interpolate(frame, [0, fps], [0, text.length], { extrapolateRight: "clamp" }));
  const cursor = frame % (fps / 2) < fps / 4;
  return (
    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 28, fontWeight: 600, color: "#1a1a1a", fontFamily: "system-ui, sans-serif", whiteSpace: "nowrap" }}>
      {text.slice(0, n)}{cursor && <span style={{ opacity: 0.6, marginLeft: 2 }}>|</span>}
    </div>
  );
};

const RollingText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = ["Flow", "Perform", "Boost", "Tokens"];
  const hold = Math.round(0.7 * fps);
  const cycle = frame % (hold * words.length);
  const idx = Math.floor(cycle / hold);
  const local = cycle - idx * hold;
  const snap = spring({ frame: local, fps, config: { damping: 18, stiffness: 180 }, durationInFrames: Math.round(0.35 * fps) });
  return (
    <div style={{ position: "absolute", bottom: 20, right: 20, width: 140, height: 48, overflow: "hidden", backgroundColor: "#FACC15", borderRadius: 4 }}>
      <div style={{ transform: `translateY(${interpolate(snap, [0, 1], [48, 0])}px)`, height: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#0F172A", fontFamily: "system-ui, sans-serif" }}>
        {words[idx]}
      </div>
    </div>
  );
};

const ArrowCircle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rot = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 3 * fps });
  return (
    <div style={{ position: "absolute", top: 20, right: 20, width: 56, height: 56, borderRadius: "50%", backgroundColor: "#1E3A5F", display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${interpolate(rot, [0, 1], [0, 360])}deg)` }}>
      <span style={{ color: "white", fontSize: 24 }}>&rarr;</span>
    </div>
  );
};

// ─── Grid layouts ───
const GAP = 5;
const GRID_BG = "#EDE9E3"; // warm off-white border color
const R = 8; // border radius
// Asymmetric splits: top row 53/47, bottom row 47/53
const TL_W = 53;
const TR_W = 100 - TL_W;
const BL_W = 47;
const BR_W = 100 - BL_W;

const Grid2x2: React.FC<{ tl: React.ReactNode; tr: React.ReactNode; bl: React.ReactNode; br: React.ReactNode }> = ({ tl, tr, bl, br }) => {
  const h = `calc(50% - ${GAP / 2}px)`;
  return (<>
    <div style={{ position: "absolute", top: 0, left: 0, width: `calc(${TL_W}% - ${GAP / 2}px)`, height: h, overflow: "hidden", borderRadius: R }}>{tl}</div>
    <div style={{ position: "absolute", top: 0, right: 0, width: `calc(${TR_W}% - ${GAP / 2}px)`, height: h, overflow: "hidden", borderRadius: R }}>{tr}</div>
    <div style={{ position: "absolute", bottom: 0, left: 0, width: `calc(${BL_W}% - ${GAP / 2}px)`, height: h, overflow: "hidden", borderRadius: R }}>{bl}</div>
    <div style={{ position: "absolute", bottom: 0, right: 0, width: `calc(${BR_W}% - ${GAP / 2}px)`, height: h, overflow: "hidden", borderRadius: R }}>{br}</div>
  </>);
};

const Grid2Top1Bot: React.FC<{ tl: React.ReactNode; tr: React.ReactNode; bottom: React.ReactNode }> = ({ tl, tr, bottom }) => {
  const h = `calc(50% - ${GAP / 2}px)`;
  return (<>
    <div style={{ position: "absolute", top: 0, left: 0, width: `calc(${TL_W}% - ${GAP / 2}px)`, height: h, overflow: "hidden", borderRadius: R }}>{tl}</div>
    <div style={{ position: "absolute", top: 0, right: 0, width: `calc(${TR_W}% - ${GAP / 2}px)`, height: h, overflow: "hidden", borderRadius: R }}>{tr}</div>
    <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: h, overflow: "hidden", borderRadius: R }}>{bottom}</div>
  </>);
};

const GridWide: React.FC<{ top: React.ReactNode; bl: React.ReactNode; br: React.ReactNode }> = ({ top, bl, br }) => {
  const h = `calc(50% - ${GAP / 2}px)`;
  return (<>
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: h, borderRadius: R, overflow: "hidden" }}>{top}</div>
    <div style={{ position: "absolute", bottom: 0, left: 0, width: `calc(${BL_W}% - ${GAP / 2}px)`, height: h, borderRadius: R, overflow: "hidden" }}>{bl}</div>
    <div style={{ position: "absolute", bottom: 0, right: 0, width: `calc(${BR_W}% - ${GAP / 2}px)`, height: h, borderRadius: R, overflow: "hidden" }}>{br}</div>
  </>);
};

// ═════════════════════════════════════════════
// Main composition
// ═════════════════════════════════════════════
export const RiddComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── Timeline ───
  const T1_START = Math.round(0.5 * fps);
  const T1_DUR = Math.round(0.55 * fps);
  const T_B_START = T1_START;
  const T_SWAP_BC = Math.round(2.0 * fps);
  const T2_START = Math.round(2.7 * fps);
  const T2_DUR = Math.round(0.55 * fps);
  const T_D_START = Math.round(3.25 * fps);
  const T_DZ_START = Math.round(5.5 * fps);
  const T_DZ_END = Math.round(6.2 * fps);

  // ─── Row-level progress (bottom row leads by a few frames) ───
  const t1_bot = interpolate(frame, [T1_START, T1_START + T1_DUR], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_BRAKE,
  });
  const t1_top = interpolate(frame, [T1_START + 3, T1_START + 3 + T1_DUR], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_BRAKE,
  });

  // Transition 2: top row leads (top-to-bottom stagger)
  const t2_top = interpolate(frame, [T2_START, T2_START + T2_DUR], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_BRAKE,
  });
  const t2_bot = interpolate(frame, [T2_START + 3, T2_START + 3 + T2_DUR], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_BRAKE,
  });

  // ─── Content swap B→C ───
  const swapBC = interpolate(frame, [T_SWAP_BC - 3, T_SWAP_BC + 10], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_BRAKE,
  });

  // ─── Dezoom ───
  const dzProg = interpolate(frame, [T_DZ_START, T_DZ_END], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const gridScale = interpolate(dzProg, [0, 1], [1, 0.25]);
  const gridTx = interpolate(dzProg, [0, 1], [0, 70]);
  const gridOp = interpolate(dzProg, [0.5, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const headW = frame < T_DZ_START ? 40
    : frame >= T_DZ_END ? 100
    : interpolate(frame, [T_DZ_START, T_DZ_END], [40, 100], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
      });

  // ─── Phase logic ───
  const t1Done = T1_START + 3 + T1_DUR + 2;
  const t2Done = T2_START + 3 + T2_DUR + 2;
  const inStableA = frame < T1_START;
  const inT1 = frame >= T1_START && frame < t1Done;
  const inStableB = frame >= t1Done && frame < T2_START;
  const inT2 = frame >= T2_START && frame < t2Done;
  const inStableD = frame >= t2Done && frame < T_DZ_END;
  const showGrid = frame < T_DZ_END;

  const rowH = `calc(50% - ${GAP / 2}px)`;
  const rowTop2 = `calc(50% + ${GAP / 2}px)`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* ─── Talking head ─── */}
      <div style={{ position: "absolute", left: 0, top: 0, width: `${headW}%`, height: "100%", overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", background: "radial-gradient(ellipse at 45% 40%, #E8DCC8 0%, #C4B08A 60%, #A89060 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: "rgba(80,60,30,0.5)", fontFamily: "system-ui, sans-serif", letterSpacing: 2 }}>TALKING HEAD</span>
        </div>
      </div>

      {/* ─── Grid ─── */}
      {showGrid && (
        <div style={{
          position: "absolute", right: 0, top: 0,
          width: `${100 - Math.min(headW, 60)}%`, height: "100%",
          overflow: "hidden", padding: GAP,
          backgroundColor: GRID_BG, borderRadius: R + 2,
          transform: `scale(${gridScale}) translateX(${gridTx}%)`,
          transformOrigin: "right center", opacity: gridOp,
        }}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>

            {/* ═══ STABLE A ═══ */}
            {inStableA && (
              <div style={{ position: "absolute", inset: 0 }}>
                <Grid2x2
                  tl={<Placeholder num={1} />}
                  tr={<Placeholder num={2} />}
                  bl={<Placeholder num={3} />}
                  br={<Placeholder num={4} />}
                />
              </div>
            )}

            {/* ═══ TRANSITION 1: A→B conveyor belt ═══ */}
            {inT1 && (
              <div style={{ position: "absolute", inset: 0 }}>
                {/* Top row: [#5 | #6] push [#1 | #2] */}
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: rowH }}>
                  <RowStrip
                    progress={t1_top}
                    newPanels={[<Placeholder num={5} />, <Placeholder num={6} />]}
                    oldPanels={[<Placeholder num={1} />, <Placeholder num={2} />]}
                    height="100%"
                  />
                </div>
                {/* Bottom row: [#7] pushes [#3 | #4] */}
                <div style={{ position: "absolute", top: rowTop2, left: 0, width: "100%", height: rowH }}>
                  <RowStrip
                    progress={t1_bot}
                    newPanels={[<Placeholder num={7} />]}
                    oldPanels={[<Placeholder num={3} />, <Placeholder num={4} />]}
                    height="100%"
                  />
                </div>
              </div>
            )}

            {/* ═══ STABLE B ═══ */}
            {inStableB && (
              <div style={{ position: "absolute", inset: 0 }}>
                <Grid2Top1Bot
                  tl={<Placeholder num={5} />}
                  tr={
                    <div style={{ width: "100%", height: "100%", position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, opacity: 1 - swapBC }}>
                        <Placeholder num={6} />
                        <Sequence from={T_B_START} layout="none"><LineDrawing /></Sequence>
                      </div>
                      <div style={{ position: "absolute", inset: 0, opacity: swapBC }}>
                        <Placeholder num={8} />
                        <Sequence from={T_SWAP_BC} layout="none"><TypewriterText text="Hi, Let's Surf" /></Sequence>
                      </div>
                    </div>
                  }
                  bottom={
                    <div style={{ width: "100%", height: "100%", position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, opacity: 1 - swapBC }}><Placeholder num={7} /></div>
                      <div style={{ position: "absolute", inset: 0, opacity: swapBC }}><Placeholder num={9} /></div>
                    </div>
                  }
                />
              </div>
            )}

            {/* ═══ TRANSITION 2: B→D vertical compress (top-to-bottom) ═══ */}
            {inT2 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "row", gap: GAP }}>
                {/* Left column: old=[#5 top half of B] → new=[#10 left + #11] */}
                <div style={{ width: `calc(${TL_W}% - ${GAP / 2}px)`, height: "100%", flexShrink: 0 }}>
                  <ColStrip
                    progress={t2_top}
                    newContent={
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: GAP }}>
                        <div style={{ flex: 1, overflow: "hidden", borderRadius: R }}><Placeholder num={10} /></div>
                        <div style={{ flex: 1, overflow: "hidden", borderRadius: R }}><Placeholder num={11} /></div>
                      </div>
                    }
                    oldContent={
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: GAP }}>
                        <div style={{ flex: 1, overflow: "hidden", borderRadius: R }}><Placeholder num={5} /></div>
                        <div style={{ flex: 1, overflow: "hidden", borderRadius: R }}><Placeholder num={9} /></div>
                      </div>
                    }
                  />
                </div>
                {/* Right column: old=[#8 top half of B] → new=[#10 right + #12] */}
                <div style={{ flex: 1, height: "100%" }}>
                  <ColStrip
                    progress={t2_bot}
                    newContent={
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: GAP }}>
                        <div style={{ flex: 1, overflow: "hidden", borderRadius: R }}><Placeholder num={10} /></div>
                        <div style={{ flex: 1, overflow: "hidden", borderRadius: R }}><Placeholder num={12} /></div>
                      </div>
                    }
                    oldContent={
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: GAP }}>
                        <div style={{ flex: 1, overflow: "hidden", borderRadius: R }}><Placeholder num={8} /></div>
                        <div style={{ flex: 1, overflow: "hidden", borderRadius: R }}><Placeholder num={9} /></div>
                      </div>
                    }
                  />
                </div>
              </div>
            )}

            {/* ═══ STABLE D ═══ */}
            {inStableD && (
              <div style={{ position: "absolute", inset: 0 }}>
                <GridWide
                  top={<Placeholder num={10} />}
                  bl={<Placeholder num={11} />}
                  br={
                    <div style={{ width: "100%", height: "100%", position: "relative" }}>
                      <Placeholder num={12} />
                      <Sequence from={T_D_START} layout="none">
                        <ArrowCircle />
                        <RollingText />
                      </Sequence>
                    </div>
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const riddMeta = {
  id: "Ridd-Replicate",
  component: RiddComposition,
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};
