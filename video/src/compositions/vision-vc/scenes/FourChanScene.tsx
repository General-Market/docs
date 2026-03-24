import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/* ── Post data ─────────────────────────────────────────────────────── */

interface Post {
  id: number;
  lines: string[];
  red?: boolean;
  /** Post ID this one quotes with >> */
  replyTo?: number;
  /** Whether this post is "(You)" */
  isYou?: boolean;
  /** File attachment info */
  file?: { size: string; dims: string };
}

const GREENTEXTS: Post[] = [
  {
    id: 91284567,
    lines: [">bought ETH at 4800", ">it's fine"],
    file: { size: "187 KB PNG", dims: "256x256" },
  },
  {
    id: 91284601,
    lines: [">sold everything for SOL", ">wife doesn't know yet"],
    replyTo: 91284567,
  },
  {
    id: 91284633,
    lines: [">anon said buy the dip", ">there is no dip, only void"],
    red: true,
    replyTo: 91284601,
    file: { size: "94 KB JPG", dims: "400x300" },
  },
  {
    id: 91284670,
    lines: [">staking rewards finally hit", ">enough for one coffee"],
    isYou: true,
  },
  {
    id: 91284712,
    lines: [">portfolio down 40%", ">calling it a hedge"],
    red: true,
    replyTo: 91284670,
  },
  {
    id: 91284749,
    lines: [">airdrop claimed", ">mass sell event in 3... 2..."],
    file: { size: "312 KB PNG", dims: "512x512" },
  },
  {
    id: 91284788,
    lines: [">just market bought with leverage", ">god can't help me now"],
    replyTo: 91284749,
  },
  {
    id: 91284820,
    lines: [">100x long liquidated", ">back to wendy's"],
    red: true,
    isYou: true,
    file: { size: "58 KB GIF", dims: "220x220" },
  },
  {
    id: 91284855,
    lines: [">new L2 launching tomorrow", ">bullish on bridge exploits"],
    replyTo: 91284820,
  },
  {
    id: 91284890,
    lines: [">anon this is financial advice", ">sue me"],
    replyTo: 91284633,
  },
  {
    id: 91284921,
    lines: [">memecoin up 900%", ">I sold yesterday"],
    red: true,
    file: { size: "245 KB PNG", dims: "350x350" },
  },
  {
    id: 91284960,
    lines: [">DCA every week like clockwork", ">clockwork into a furnace"],
    replyTo: 91284921,
  },
];

/* ── Colors ────────────────────────────────────────────────────────── */

const GREEN = "#789922";
const RED_TEXT = "#cc4444";
const BORDER = "#3c3f41";
const GREY = "#707070";
const QUOTE_LINK = "#d00000";
const NAME_COLOR = "#117743";
const SUBJECT_COLOR = "#b294bb";

/* ── ASCII watermark ───────────────────────────────────────────────── */

const WOJAK_ASCII = [
  "          _______________        ",
  "         /               \\       ",
  "        /                 \\      ",
  "       |    __       __    |     ",
  "       |   |  |     |  |   |    ",
  "       |   |__|     |__|   |    ",
  "       |                   |    ",
  "       |     \\_______/     |    ",
  "        \\                 /     ",
  "         \\_______._______/      ",
  "                 |              ",
  "                 |              ",
].join("\n");

/* ── Velocity flash thresholds ─────────────────────────────────────── */

const FLASH_THRESHOLDS = [500, 700, 850];

/* ── Component ─────────────────────────────────────────────────────── */

export const FourChanScene: React.FC = () => {
  const frame = useCurrentFrame();

  const velocity = Math.floor(
    interpolate(frame, [0, 150], [340, 890], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  // Determine if velocity is flashing (just crossed a threshold)
  const prevVelocity = Math.floor(
    interpolate(Math.max(0, frame - 1), [0, 150], [340, 890], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  let isFlashing = false;
  for (const threshold of FLASH_THRESHOLDS) {
    if (prevVelocity < threshold && velocity >= threshold) {
      isFlashing = true;
      break;
    }
  }
  // Also flash for a few frames after crossing
  const flashDuration = 8;
  let flashOpacity = 0;
  for (const threshold of FLASH_THRESHOLDS) {
    // Find the frame where this threshold was crossed
    const crossFrame = Math.ceil(
      interpolate(threshold, [340, 890], [0, 150], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    );
    if (frame >= crossFrame && frame < crossFrame + flashDuration) {
      flashOpacity = interpolate(
        frame,
        [crossFrame, crossFrame + 3, crossFrame + flashDuration],
        [0, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      isFlashing = true;
    }
  }

  const scrollOffset = frame * 3.2;
  const visiblePosts = GREENTEXTS.filter((_, i) => frame > i * 10);

  // Thread stats that grow over time
  const replyCount = Math.floor(
    interpolate(frame, [0, 150], [287, 412], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const imageCount = Math.floor(
    interpolate(frame, [0, 150], [43, 67], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        fontFamily: "'Courier New', Consolas, monospace",
        overflow: "hidden",
      }}
    >

      {/* ASCII wojak watermark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#ffffff08",
          fontSize: 28,
          lineHeight: 1.1,
          whiteSpace: "pre",
          fontFamily: "'Courier New', Consolas, monospace",
          pointerEvents: "none",
          zIndex: 0,
          letterSpacing: 0,
        }}
      >
        {WOJAK_ASCII}
      </div>

      {/* Board label */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 48,
          color: "#c5c8c6",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1,
          zIndex: 5,
        }}
      >
        /biz/ — Business &amp; Finance
      </div>

      {/* Thread header */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 48,
          display: "flex",
          gap: 16,
          alignItems: "baseline",
          zIndex: 5,
        }}
      >
        <span
          style={{
            color: SUBJECT_COLOR,
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          Thread #91284
        </span>
        <span
          style={{
            color: GREY,
            fontSize: 12,
          }}
        >
          [{replyCount} replies / {imageCount} images]
        </span>
      </div>

      {/* Post velocity */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 56,
          textAlign: "right",
          zIndex: 5,
        }}
      >
        <div
          style={{
            color: GREY,
            fontSize: 13,
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          POST VELOCITY
        </div>
        <div
          style={{
            position: "relative",
            display: "inline-block",
          }}
        >
          {/* Flash glow behind the number */}
          {isFlashing && (
            <div
              style={{
                position: "absolute",
                inset: "-12px -20px",
                background: `radial-gradient(ellipse, rgba(120,153,34,${flashOpacity * 0.4}) 0%, transparent 70%)`,
                borderRadius: 8,
                pointerEvents: "none",
              }}
            />
          )}
          <div
            style={{
              color: isFlashing
                ? `rgba(120,153,34,${0.6 + flashOpacity * 0.4})`
                : GREEN,
              fontSize: 42,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              textShadow: isFlashing
                ? `0 0 ${12 * flashOpacity}px ${GREEN}`
                : "none",
              transform: isFlashing
                ? `scale(${1 + flashOpacity * 0.08})`
                : "scale(1)",
            }}
          >
            {velocity}
            <span
              style={{ fontSize: 18, color: GREY, marginLeft: 6 }}
            >
              /min
            </span>
          </div>
        </div>
      </div>

      {/* Posts container — scrolls up */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 48,
          right: 48,
          bottom: 0,
          transform: `translateY(-${scrollOffset}px)`,
          zIndex: 1,
        }}
      >
        {visiblePosts.map((post, i) => {
          const entryFrame = i * 10;
          const opacity = interpolate(
            frame,
            [entryFrame, entryFrame + 12],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const textColor = post.red ? RED_TEXT : GREEN;
          const timestamp = `03/21/26(Fri)18:${String(4 + i).padStart(2, "0")}:${String((i * 17) % 60).padStart(2, "0")}`;

          return (
            <div
              key={post.id}
              style={{
                opacity: opacity * 0.6,
                background: "rgba(40,42,46,0.7)",
                border: `1px solid ${BORDER}`,
                borderRadius: 2,
                padding: "14px 20px",
                marginBottom: 12,
                maxWidth: 860,
              }}
            >
              {/* Post header: Anonymous + timestamp + post number */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 6,
                  fontSize: 13,
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: NAME_COLOR, fontWeight: 700 }}>
                  Anonymous
                </span>
                <span style={{ color: "#5c6370" }}>{timestamp}</span>
                <span style={{ color: "#81a2be" }}>
                  No.{post.id}
                </span>
                {post.isYou && (
                  <span
                    style={{
                      color: "#d00",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    (You)
                  </span>
                )}
              </div>

              {/* File info line */}
              {post.file && (
                <div
                  style={{
                    fontSize: 11,
                    color: GREY,
                    marginBottom: 8,
                  }}
                >
                  File:{" "}
                  <span style={{ color: "#81a2be", textDecoration: "underline" }}>
                    {post.id}.{post.file.size.split(" ")[1]?.toLowerCase() ?? "png"}
                  </span>{" "}
                  ({post.file.size}, {post.file.dims})
                </div>
              )}

              {/* Image placeholder + text side by side */}
              <div style={{ display: "flex", gap: 14 }}>
                {/* Image thumbnail placeholder */}
                {post.file && (
                  <div
                    style={{
                      width: 86,
                      height: 86,
                      minWidth: 86,
                      background: "#1d1f21",
                      border: `1px solid ${BORDER}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        color: "#4a4d50",
                        fontSize: 9,
                        letterSpacing: 0.5,
                      }}
                    >
                      {post.file.dims}
                    </div>
                    <div
                      style={{
                        width: 40,
                        height: 1,
                        background: "#3c3f41",
                      }}
                    />
                    <div
                      style={{
                        color: "#3c3f41",
                        fontSize: 8,
                      }}
                    >
                      {post.file.size.split(" ")[1]}
                    </div>
                  </div>
                )}

                {/* Post body */}
                <div>
                  {/* Reply quote link */}
                  {post.replyTo && (
                    <div
                      style={{
                        color: QUOTE_LINK,
                        fontSize: 13,
                        marginBottom: 4,
                        cursor: "pointer",
                      }}
                    >
                      &gt;&gt;{post.replyTo}
                    </div>
                  )}

                  {/* Greentext lines */}
                  {post.lines.map((line, j) => (
                    <div
                      key={j}
                      style={{
                        color: textColor,
                        fontSize: 19,
                        lineHeight: 1.5,
                        fontWeight: 400,
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top fade */}
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 0,
          right: 0,
          height: 60,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
          zIndex: 4,
        }}
      />
      {/* Bottom fade */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 100,
          background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
          zIndex: 4,
        }}
      />
    </AbsoluteFill>
  );
};
