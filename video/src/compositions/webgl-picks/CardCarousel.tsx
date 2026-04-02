// Source: https://codepen.io/ecemgo/full/vYPadZz
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

/* ─── Song data (matches original CodePen) ─── */

interface Song {
  title: string;
  artist: string;
  /** Gradient used to generate album art procedurally */
  coverGradient: [string, string];
  /** Accent shape for the album art */
  accent: "circle" | "triangle" | "diamond" | "lines" | "burst" | "wave" | "flame";
}

const SONGS: Song[] = [
  {
    title: "Symphony",
    artist: "Clean Bandit ft. Zara Larsson",
    coverGradient: ["#1a0a2e", "#e8451c"],
    accent: "flame",
  },
  {
    title: "Pawn It All",
    artist: "Alicia Keys",
    coverGradient: ["#0d1b2a", "#c850c0"],
    accent: "triangle",
  },
  {
    title: "Seni Dert Etmeler",
    artist: "Madrigal",
    coverGradient: ["#1a0a14", "#e87420"],
    accent: "lines",
  },
  {
    title: "Instant Crush",
    artist: "Daft Punk ft. Julian Casablancas",
    coverGradient: ["#0a0a1a", "#00d4ff"],
    accent: "circle",
  },
  {
    title: "As It Was",
    artist: "Harry Styles",
    coverGradient: ["#1a1a1a", "#ff4444"],
    accent: "diamond",
  },
  {
    title: "Physical",
    artist: "Dua Lipa",
    coverGradient: ["#1a0820", "#a855f7"],
    accent: "burst",
  },
  {
    title: "Delicate",
    artist: "Taylor Swift",
    coverGradient: ["#001428", "#3b82f6"],
    accent: "wave",
  },
];

/* ─── Coverflow geometry (matching Swiper config) ─── */

const CARD_SIZE = 200; // max-width: 200px, aspect-ratio: 1/1
const CARD_RADIUS = 10;
const SPACE_BETWEEN = 40;

/** Swiper coverflowEffect parameters */
const COVERFLOW_ROTATE = 25; // degrees
const COVERFLOW_DEPTH = 50; // px
const COVERFLOW_STRETCH = 0;
const COVERFLOW_MODIFIER = 1;

/* ─── Background animation (matches @keyframes slidein) ─── */

const BG_CYCLE_FRAMES = 3600; // 120s at 30fps, full cycle

/* ─── Timing ─── */

const SLIDE_HOLD = 75; // frames per slide (2.5s at 30fps)
const TRANSITION_FRAMES = 24; // 0.8s smooth slide transition
const ENTRY_FRAMES = 20; // initial fade-in duration
const PROGRESS_SPEED = 0.7; // how fast the progress bar fills per slide

/* ─── Colors ─── */

const PRIMARY_CLR = "rgba(228, 228, 229, 1)";
const PRIMARY_CLR_DIM = "rgba(228, 228, 229, 0.6)";
const CONTROL_BG = "rgba(163, 162, 164, 0.3)";
const CONTROL_BORDER = "rgba(255, 255, 255, 0.3)";
const PROGRESS_BG = "rgba(163, 162, 164, 0.4)";
const PROGRESS_THUMB = "rgba(163, 162, 164, 0.9)";

/* ─── Helpers ─── */

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/* ─── Album art generator (procedural covers) ─── */

const AlbumArt: React.FC<{
  song: Song;
  size: number;
}> = ({ song, size }) => {
  const [c1, c2] = song.coverGradient;

  const accentElement = useMemo(() => {
    const cx = size / 2;
    const cy = size / 2;

    switch (song.accent) {
      case "circle":
        return (
          <circle
            cx={cx}
            cy={cy}
            r={size * 0.3}
            fill="none"
            stroke={c2}
            strokeWidth={3}
            opacity={0.9}
          />
        );
      case "triangle":
        return (
          <polygon
            points={`${cx},${cy - size * 0.3} ${cx - size * 0.26},${cy + size * 0.2} ${cx + size * 0.26},${cy + size * 0.2}`}
            fill="none"
            stroke={c2}
            strokeWidth={2.5}
            opacity={0.85}
          />
        );
      case "diamond":
        return (
          <polygon
            points={`${cx},${cy - size * 0.28} ${cx + size * 0.2},${cy} ${cx},${cy + size * 0.28} ${cx - size * 0.2},${cy}`}
            fill={c2}
            opacity={0.4}
          />
        );
      case "lines":
        return (
          <g opacity={0.6}>
            {Array.from({ length: 5 }).map((_, i) => (
              <line
                key={i}
                x1={size * 0.2}
                y1={cy - size * 0.2 + i * (size * 0.1)}
                x2={size * 0.8}
                y2={cy - size * 0.2 + i * (size * 0.1)}
                stroke={c2}
                strokeWidth={2}
              />
            ))}
          </g>
        );
      case "burst": {
        const rays = 8;
        return (
          <g opacity={0.7}>
            {Array.from({ length: rays }).map((_, i) => {
              const angle = (i / rays) * Math.PI * 2;
              return (
                <line
                  key={i}
                  x1={cx + Math.cos(angle) * size * 0.1}
                  y1={cy + Math.sin(angle) * size * 0.1}
                  x2={cx + Math.cos(angle) * size * 0.35}
                  y2={cy + Math.sin(angle) * size * 0.35}
                  stroke={c2}
                  strokeWidth={2}
                />
              );
            })}
          </g>
        );
      }
      case "wave":
        return (
          <path
            d={`M ${size * 0.15} ${cy} Q ${size * 0.35} ${cy - size * 0.2} ${cx} ${cy} Q ${size * 0.65} ${cy + size * 0.2} ${size * 0.85} ${cy}`}
            fill="none"
            stroke={c2}
            strokeWidth={3}
            opacity={0.7}
          />
        );
      case "flame":
        return (
          <ellipse
            cx={cx}
            cy={cy - size * 0.05}
            rx={size * 0.15}
            ry={size * 0.25}
            fill={c2}
            opacity={0.5}
          />
        );
    }
  }, [song.accent, size, c2]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ borderRadius: CARD_RADIUS }}
    >
      <defs>
        <radialGradient id={`bg-${song.title}`} cx="50%" cy="50%" r="80%">
          <stop offset="0%" stopColor={c2} stopOpacity={0.3} />
          <stop offset="100%" stopColor={c1} stopOpacity={1} />
        </radialGradient>
      </defs>
      <rect width={size} height={size} fill={`url(#bg-${song.title})`} />
      {accentElement}
    </svg>
  );
};

/* ─── Play icon SVG ─── */

const PlayIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={PRIMARY_CLR}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

const BackwardIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={PRIMARY_CLR}>
    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
  </svg>
);

const ForwardIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={PRIMARY_CLR}>
    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
  </svg>
);

/* ─── Main component ─── */

export const CardCarousel: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  /* ─── Entry fade ─── */
  const entryOpacity = interpolate(frame, [0, ENTRY_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const entryScale = interpolate(frame, [0, ENTRY_FRAMES], [0.95, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  /* ─── Background pan (matches @keyframes slidein) ─── */
  const bgProgress = (frame % BG_CYCLE_FRAMES) / BG_CYCLE_FRAMES;
  const bgX = interpolate(
    bgProgress < 0.5 ? bgProgress * 2 : 2 - bgProgress * 2,
    [0, 1],
    [20, 100],
  );
  const bgSize = interpolate(
    bgProgress < 0.5 ? bgProgress * 2 : 2 - bgProgress * 2,
    [0, 1],
    [3400, 2400],
  );

  /* ─── Current slide index (auto-advance with smooth transitions) ─── */
  const totalCycleFrames = SLIDE_HOLD * SONGS.length;
  const cycleFrame = frame % totalCycleFrames;
  const rawSlideIndex = cycleFrame / SLIDE_HOLD;
  const currentSlideInt = Math.floor(rawSlideIndex);
  const slideTransitionProgress = rawSlideIndex - currentSlideInt;

  // Smooth transition: ease the last portion of each slide hold
  const transitionT = clamp(
    (slideTransitionProgress * SLIDE_HOLD - (SLIDE_HOLD - TRANSITION_FRAMES)) /
      TRANSITION_FRAMES,
    0,
    1,
  );
  const easedT = Easing.inOut(Easing.cubic)(transitionT);

  // The initial slide is index 3 (matching initialSlide: 3 in Swiper config)
  const baseIndex = 3;
  const activeSlideFloat =
    ((baseIndex + currentSlideInt + easedT) % SONGS.length);
  const activeSlideIndex =
    (baseIndex + currentSlideInt) % SONGS.length;
  const nextSlideIndex =
    (baseIndex + currentSlideInt + 1) % SONGS.length;

  /* ─── Current song info (for music player) ─── */
  const currentSong = SONGS[activeSlideIndex];
  const nextSong = SONGS[nextSlideIndex];

  // Text crossfade during transition
  const textSwapT = clamp(easedT * 3 - 1, 0, 1); // starts fading at ~33% of transition
  const displayTitle = textSwapT > 0.5 ? nextSong.title : currentSong.title;
  const displayArtist = textSwapT > 0.5 ? nextSong.artist : currentSong.artist;
  const textOpacity = textSwapT > 0.5
    ? interpolate(textSwapT, [0.5, 1], [0, 1])
    : interpolate(textSwapT, [0, 0.5], [1, 0.3]);

  /* ─── Progress bar ─── */
  const progressInSlide = slideTransitionProgress;
  const progressValue = interpolate(progressInSlide, [0, 0.85], [0, PROGRESS_SPEED], {
    extrapolateRight: "clamp",
  });

  /* ─── Play button pulse ─── */
  const pulseScale = 1.3 + Math.sin(frame * 0.08) * 0.02;

  /* ─── Carousel card layout ─── */

  const centerX = width / 2;
  const centerY = height * 0.38; // cards sit in upper portion, player below

  const cards = useMemo(() => {
    return SONGS.map((song, i) => {
      // Distance from center in slide units
      const offset = i - activeSlideFloat;
      // Wrap around for infinite feel
      const wrappedOffset =
        offset > SONGS.length / 2
          ? offset - SONGS.length
          : offset < -SONGS.length / 2
            ? offset + SONGS.length
            : offset;

      /* ─── Coverflow transforms (matching Swiper coverflow parameters) ─── */
      const normalizedOffset = wrappedOffset;
      const absOffset = Math.abs(normalizedOffset);

      // Rotation: cards rotate away from center
      const rotateY =
        -normalizedOffset *
        COVERFLOW_ROTATE *
        COVERFLOW_MODIFIER;

      // Depth: cards pushed back from center
      const translateZ = -absOffset * COVERFLOW_DEPTH * COVERFLOW_MODIFIER;

      // X translation: spacing between cards
      const translateX =
        normalizedOffset * (CARD_SIZE + SPACE_BETWEEN) +
        normalizedOffset * COVERFLOW_STRETCH * COVERFLOW_MODIFIER;

      // Scale: center card slightly larger
      const scale = interpolate(absOffset, [0, 1, 3], [1, 0.92, 0.85], {
        extrapolateRight: "clamp",
      });

      // Opacity: fade distant cards
      const opacity = interpolate(absOffset, [0, 2.5, 4], [1, 0.7, 0.3], {
        extrapolateRight: "clamp",
      });

      // Z-index: center card on top
      const zIndex = Math.round((10 - absOffset) * 10);

      return {
        song,
        index: i,
        translateX,
        translateZ,
        rotateY,
        scale,
        opacity,
        zIndex,
        absOffset,
      };
    });
  }, [activeSlideFloat]);

  /* ─── Wavy background streaks ─── */
  const wavePath1 = useMemo(() => {
    const t = frame * 0.005;
    const points: string[] = [];
    for (let x = -100; x <= width + 100; x += 40) {
      const y =
        height * 0.65 +
        Math.sin(x * 0.003 + t) * 60 +
        Math.sin(x * 0.007 + t * 1.5) * 30;
      points.push(`${x},${y}`);
    }
    return `M ${points[0]} ${points.slice(1).map((p) => `L ${p}`).join(" ")}`;
  }, [frame, width, height]);

  const wavePath2 = useMemo(() => {
    const t = frame * 0.004 + 2;
    const points: string[] = [];
    for (let x = -100; x <= width + 100; x += 40) {
      const y =
        height * 0.7 +
        Math.sin(x * 0.004 + t) * 50 +
        Math.cos(x * 0.006 + t * 0.8) * 25;
      points.push(`${x},${y}`);
    }
    return `M ${points[0]} ${points.slice(1).map((p) => `L ${p}`).join(" ")}`;
  }, [frame, width, height]);

  return (
    <AbsoluteFill
      style={{
        opacity: entryOpacity,
        transform: `scale(${entryScale})`,
      }}
    >
      {/* ─── Background: dark purple gradient with slow pan ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at ${bgX}% 30%, rgba(40, 15, 60, 1) 0%, transparent 60%),
            radial-gradient(ellipse at ${100 - bgX}% 70%, rgba(20, 8, 40, 0.8) 0%, transparent 50%),
            linear-gradient(180deg, #0d0415 0%, #150a28 40%, #0a0612 100%)
          `,
          backgroundSize: `${bgSize}px auto`,
        }}
      />

      {/* ─── Subtle wavy light streaks ─── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="streak-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="rgba(160, 120, 200, 0.08)" />
            <stop offset="50%" stopColor="rgba(180, 140, 220, 0.12)" />
            <stop offset="70%" stopColor="rgba(160, 120, 200, 0.08)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="streak-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="40%" stopColor="rgba(140, 100, 180, 0.06)" />
            <stop offset="60%" stopColor="rgba(140, 100, 180, 0.09)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path
          d={wavePath1}
          fill="none"
          stroke="url(#streak-grad-1)"
          strokeWidth={2}
        />
        <path
          d={wavePath2}
          fill="none"
          stroke="url(#streak-grad-2)"
          strokeWidth={1.5}
        />
      </svg>

      {/* ─── Backdrop blur overlay ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* ─── Card carousel ─── */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          top: 0,
          bottom: 0,
          perspective: 1800,
          transformStyle: "preserve-3d",
        }}
      >
        {cards
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((card) => {
            const { song, index, translateX, translateZ, rotateY, scale, opacity, zIndex, absOffset } = card;

            return (
              <div
                key={index}
                style={{
                  position: "absolute",
                  left: centerX - CARD_SIZE / 2,
                  top: centerY - CARD_SIZE / 2,
                  width: CARD_SIZE,
                  zIndex,
                  transformStyle: "preserve-3d",
                  transform: [
                    `translateX(${translateX}px)`,
                    `translateZ(${translateZ}px)`,
                    `rotateY(${rotateY}deg)`,
                    `scale(${scale})`,
                  ].join(" "),
                  opacity,
                }}
              >
                {/* ─── Card image ─── */}
                <div
                  style={{
                    width: CARD_SIZE,
                    height: CARD_SIZE,
                    borderRadius: CARD_RADIUS,
                    overflow: "hidden",
                    boxShadow:
                      absOffset < 0.5
                        ? "0 20px 60px rgba(0, 0, 0, 0.5)"
                        : "0 10px 30px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  <AlbumArt song={song} size={CARD_SIZE} />
                </div>

                {/* ─── Reflection (CSS box-reflect simulation) ─── */}
                <div
                  style={{
                    width: CARD_SIZE,
                    height: CARD_SIZE * 0.5,
                    marginTop: -5, // -5px gap matching original
                    borderRadius: CARD_RADIUS,
                    overflow: "hidden",
                    transform: "scaleY(-1)",
                    transformOrigin: "top center",
                    maskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 60%)",
                    WebkitMaskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 60%)",
                  }}
                >
                  <AlbumArt song={song} size={CARD_SIZE} />
                </div>
              </div>
            );
          })}
      </div>

      {/* ─── Music player ─── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: centerY + CARD_SIZE / 2 + CARD_SIZE * 0.5 + 30,
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 380,
          padding: "10px 30px",
        }}
      >
        {/* ─── Title ─── */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: PRIMARY_CLR,
            fontFamily: "'Nunito', system-ui, sans-serif",
            lineHeight: 1.6,
            textAlign: "center",
            opacity: interpolate(textOpacity, [0.3, 1], [0.7, 1]),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 360,
          }}
        >
          {displayTitle}
        </div>

        {/* ─── Artist ─── */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 400,
            color: PRIMARY_CLR_DIM,
            fontFamily: "'Nunito', system-ui, sans-serif",
            textAlign: "center",
            opacity: interpolate(textOpacity, [0.3, 1], [0.6, 1]),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 360,
          }}
        >
          {displayArtist}
        </div>

        {/* ─── Progress bar ─── */}
        <div
          style={{
            width: "100%",
            height: 7,
            background: PROGRESS_BG,
            borderRadius: 4,
            marginTop: 32,
            marginBottom: 24,
            position: "relative",
          }}
        >
          {/* ─── Filled portion ─── */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${progressValue * 100}%`,
              background: "rgba(163, 162, 164, 0.6)",
              borderRadius: 4,
            }}
          />
          {/* ─── Thumb ─── */}
          <div
            style={{
              position: "absolute",
              left: `${progressValue * 100}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: PROGRESS_THUMB,
              outline: `4px solid ${PRIMARY_CLR}`,
              boxShadow: "0 6px 10px rgba(5, 36, 28, 0.3)",
            }}
          />
        </div>

        {/* ─── Controls ─── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 40,
            marginTop: 20,
          }}
        >
          {/* Backward */}
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: CONTROL_BG,
              border: `1px solid ${CONTROL_BORDER}`,
              boxShadow: "0 10px 20px rgba(5, 36, 28, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BackwardIcon />
          </div>

          {/* Play/Pause (1.3x scale) */}
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: CONTROL_BG,
              border: `1px solid ${CONTROL_BORDER}`,
              boxShadow: "0 10px 20px rgba(5, 36, 28, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${pulseScale})`,
            }}
          >
            <PlayIcon size={20} />
          </div>

          {/* Forward */}
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: CONTROL_BG,
              border: `1px solid ${CONTROL_BORDER}`,
              boxShadow: "0 10px 20px rgba(5, 36, 28, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ForwardIcon />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
