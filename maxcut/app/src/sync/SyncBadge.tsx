// SyncBadge — the small chain icon in a clip's top-right corner.
// Amber when the clip carries a non-zero syncOffsetFrames.
// Red when the clip is flagged as drifted.
// No animation. A badge that pulses would suggest it might fix itself.

import type { Clip } from "../project/schema";

export type SyncBadgeProps = {
  clip: Clip;
  drifted?: boolean;
};

const SIZE = 12;

export function SyncBadge({ clip, drifted }: SyncBadgeProps) {
  const offset = clip.syncOffsetFrames ?? 0;
  if (!drifted && offset === 0) return null;

  const color = drifted ? "#E8657A" : "#E8A24B";
  const label = offset === 0 ? "drift" : `${offset > 0 ? "+" : ""}${offset}f`;

  return (
    <span
      role="status"
      aria-label={drifted ? `drifted ${label}` : `sync offset ${label}`}
      style={{
        position: "absolute",
        top: 2,
        right: 2,
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        color,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
        lineHeight: 1,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox="0 0 12 12"
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4.5 7.5 L7.5 4.5" />
        <path d="M3 6a2.1 2.1 0 0 1 0-3l1-1a2.1 2.1 0 0 1 3 3" />
        <path d="M9 6a2.1 2.1 0 0 1 0 3l-1 1a2.1 2.1 0 0 1-3-3" />
      </svg>
      <span>{label}</span>
    </span>
  );
}

export default SyncBadge;
