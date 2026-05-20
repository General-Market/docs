// Folding-circle loop — six colored pages of a sphere flip in sequence, each
// flip revealing the next. The original was a CSS-keyframe spinner from
// CodePen (jkantner). Here it is rebuilt as frame-based interpolation so the
// motion survives Remotion's deterministic rendering.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

// ── Timing ──────────────────────────────────────────────────────────────────

const STAGES = 6;
const CYCLE_FRAMES = 360; // 6s at 60fps — same cadence as the source CSS
const SIZE = 480; // px — large enough to dominate the 1920×1080 canvas

const easing = Easing.bezier(0.65, 0, 0.35, 1);

// ── Palette ─────────────────────────────────────────────────────────────────

const GREEN = "hsl(123, 90%, 30%)";
const RED = "hsl(0, 90%, 50%)";
const BLUE = "hsl(223, 90%, 50%)";
const YELLOW = "hsl(43, 90%, 50%)";
const HOTPINK = "hsl(330, 90%, 50%)";
const TEAL = "hsl(183, 90%, 40%)";

// ── Icons (inline so we don't pull lucide-react just for six glyphs) ────────

type IconProps = { size: number };
const stroke = "#fff";
const sw = 2;

const ArrowUp: React.FC<IconProps> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </svg>
);
const Heart: React.FC<IconProps> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z" />
  </svg>
);
const Crown: React.FC<IconProps> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    <path d="M5 21h14" />
  </svg>
);
const Star: React.FC<IconProps> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
  </svg>
);
const Zap: React.FC<IconProps> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  </svg>
);
const Coins: React.FC<IconProps> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </svg>
);

// ── Pages: id, color, icon ──────────────────────────────────────────────────

type Page = {
  id: number;
  color: string;
  Icon: React.FC<IconProps>;
};

const PAGES: Page[] = [
  { id: 1, color: GREEN, Icon: ArrowUp },
  { id: 2, color: RED, Icon: Heart },
  { id: 3, color: BLUE, Icon: Crown },
  { id: 4, color: YELLOW, Icon: Star },
  { id: 5, color: HOTPINK, Icon: Zap },
  { id: 6, color: TEAL, Icon: Coins },
  { id: 7, color: GREEN, Icon: ArrowUp }, // loop seam — same as page 1
];

// ── State per page, per frame ───────────────────────────────────────────────

function loopT(frame: number): number {
  return (frame % CYCLE_FRAMES) / CYCLE_FRAMES;
}

// The "B" (right) half flips from 0° to −180° during the page's own stage.
// Page p flips at stage p, for p = 1..6. Page 7 doesn't flip — its B half is
// just the loop-seam continuation.
function pageBRotation(p: number, t: number): number {
  if (p === 7) return 0;
  const startT = (p - 1) / STAGES;
  const endT = p / STAGES;
  if (t < startT) return 0;
  if (t >= endT) return -180;
  const local = (t - startT) / (endT - startT);
  return interpolate(easing(local), [0, 1], [0, -180]);
}

// The "A" (left) half holds at 180° (back-facing, hidden) until stage p−1
// flips, then arrives at 0° in time to act as the new left half.
function pageARotation(p: number, t: number): number {
  if (p === 1) return 0;
  const startT = (p - 2) / STAGES;
  const endT = (p - 1) / STAGES;
  if (t < startT) return 180;
  if (t >= endT) return 0;
  const local = (t - startT) / (endT - startT);
  return interpolate(easing(local), [0, 1], [180, 0]);
}

// Visibility of the "A" half — visible from when it arrives at 0° until the
// next page's A overtakes it. Page 1 starts visible; page 7 covers the seam
// at the loop boundary.
function pageAVisible(p: number, t: number): boolean {
  if (p === 1) return t < 1 / STAGES;
  if (p === 7) return t >= 5 / STAGES;
  return t >= (p - 2) / STAGES && t < p / STAGES;
}

// Visibility of the "B" half — pages 1 and 2 are always visible; pages 3+
// only after their predecessor's predecessor has flipped past them.
function pageBVisible(p: number, t: number): boolean {
  if (p <= 2) return true;
  if (p === 7) return t >= 5 / STAGES;
  return t >= (p - 2) / STAGES;
}

// The cast shadow under a page dips to 0 the moment that page itself is the
// one flipping. Otherwise it sits at full opacity.
function pageShadowOpacity(p: number, t: number): number {
  if (p === 1) {
    return Math.min(t * STAGES, 1);
  }
  if (p === 7) {
    if (t < 5 / STAGES) return 1;
    const local = (t - 5 / STAGES) / (1 / STAGES);
    return interpolate(local, [0, 1], [1, 0]);
  }
  const dipT = (p - 1) / STAGES;
  const halfStage = 1 / (STAGES * 2);
  const dist = Math.abs(t - dipT);
  if (dist >= halfStage) return 1;
  return easing(dist / halfStage);
}

// ── Page renderer ───────────────────────────────────────────────────────────

const Half: React.FC<{
  page: Page;
  side: "left" | "right";
  rotateY: number;
  visible: boolean;
  shadowOpacity: number;
  zIndex: number;
}> = ({ page, side, rotateY, visible, shadowOpacity, zIndex }) => {
  const clip =
    side === "left"
      ? "polygon(0 0, 50% 0, 50% 100%, 0 100%)"
      : "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)";
  const { Icon } = page;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backfaceVisibility: "hidden",
        borderRadius: "50%",
        backgroundColor: page.color,
        clipPath: clip,
        display: "grid",
        placeItems: "center",
        transform: `rotateY(${rotateY}deg)`,
        visibility: visible ? "visible" : "hidden",
        zIndex,
      }}
    >
      {/* Cast shadow — the dark seam under the flipping fold */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          height: "100%",
          width: 0,
          boxShadow: "0 0 12px 6px hsla(0, 0%, 0%, 0.6)",
          opacity: shadowOpacity,
          pointerEvents: "none",
        }}
      />
      <Icon size={SIZE * 0.5} />
    </div>
  );
};

// ── Composition ─────────────────────────────────────────────────────────────

export const FoldingCircleLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const t = loopT(frame);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "hsl(223, 10%, 5%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: SIZE,
          height: SIZE,
          perspective: 2400,
          transformStyle: "preserve-3d",
        }}
      >
        {PAGES.map((page) => {
          const aRot = pageARotation(page.id, t);
          const bRot = pageBRotation(page.id, t);
          const aVis = pageAVisible(page.id, t);
          const bVis = pageBVisible(page.id, t);
          const shadow = pageShadowOpacity(page.id, t);
          // Pages stack back-to-front so later pages sit underneath earlier ones
          // — same intent as the original `z-index: -$p` on the B halves.
          const zIndex = -page.id;
          return (
            <React.Fragment key={page.id}>
              <Half
                page={page}
                side="left"
                rotateY={aRot}
                visible={aVis}
                shadowOpacity={shadow}
                zIndex={zIndex + 7}
              />
              <Half
                page={page}
                side="right"
                rotateY={bRot}
                visible={bVis}
                shadowOpacity={shadow}
                zIndex={zIndex}
              />
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
