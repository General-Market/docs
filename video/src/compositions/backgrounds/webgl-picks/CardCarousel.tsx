// Source: https://codepen.io/ecemgo/full/vYPadZz
// Original repo: https://github.com/ecemgo/mini-samples-great-tricks/tree/main/music-player-with-slider
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
  staticFile,
} from "remotion";

/* ── Song data (verbatim from original app.js) ── */

interface Song {
  title: string;
  name: string;
  img: string;
}

const SONGS: Song[] = [
  {
    title: "Symphony",
    name: "Clean Bandit ft. Zara Larsson",
    img: staticFile("compositions/card-carousel/img-1.jpg"),
  },
  {
    title: "Pawn It All",
    name: "Alicia Keys",
    img: staticFile("compositions/card-carousel/img-2.jpg"),
  },
  {
    title: "Seni Dert Etmeler",
    name: "Madrigal",
    img: staticFile("compositions/card-carousel/img-3.jpg"),
  },
  {
    title: "Instant Crush",
    name: "Daft Punk ft. Julian Casablancas",
    img: staticFile("compositions/card-carousel/img-4.jpg"),
  },
  {
    title: "As It Was",
    name: "Harry Styles",
    img: staticFile("compositions/card-carousel/img-5.jpg"),
  },
  {
    title: "Physical",
    name: "Dua Lipa",
    img: staticFile("compositions/card-carousel/img-6.jpg"),
  },
  {
    title: "Delicate",
    name: "Taylor Swift",
    img: staticFile("compositions/card-carousel/img-7.jpg"),
  },
];

/* ── Swiper coverflow config (verbatim from original app.js) ── */

const INITIAL_SLIDE = 3;
const CARD_SIZE = 200; // max-width: 200px, aspect-ratio: 1/1
const CARD_RADIUS = 10; // border-radius: 10px
const SPACE_BETWEEN = 40; // spaceBetween: 40

const COVERFLOW_ROTATE = 25; // rotate: 25
const COVERFLOW_STRETCH = 0; // stretch: 0
const COVERFLOW_DEPTH = 50; // depth: 50
const COVERFLOW_MODIFIER = 1; // modifier: 1

/* ── Background animation (from @keyframes slidein, 120s) ── */

const BG_CYCLE_FRAMES = 3600; // 120s at 30fps

/* ── CSS values (verbatim from original style.css) ── */

const PRIMARY_CLR = "rgba(228, 228, 229, 1)"; // --primary-clr
const SWIPER_PADDING_TOP = 40; // .swiper padding: 40px 0 100px
const SWIPER_PADDING_BOTTOM = 100;
const MUSIC_PLAYER_WIDTH = 380; // .music-player width: 380px
const PROGRESS_HEIGHT = 7; // #progress height: 7px
const PROGRESS_BG = "rgba(163, 162, 164, 0.4)";
const PROGRESS_THUMB_BG = "rgba(163, 162, 164, 0.9)";
const PROGRESS_THUMB_SIZE = 16;
const CONTROL_SIZE = 50; // .controls button width: 50px
const CONTROL_BG = "rgba(163, 162, 164, 0.3)";
const CONTROL_BORDER = "rgba(255, 255, 255, 0.3)";
const CONTROL_SHADOW = "0 10px 20px rgba(5, 36, 28, 0.3)";
const CONTROL_MARGIN = 20; // .controls button margin: 20px
const CENTER_BUTTON_SCALE = 1.3; // .controls button:nth-child(2) scale(1.3)

/* ── Timing ── */

const SLIDE_HOLD = 75; // frames per slide (~2.5s at 30fps)
const TRANSITION_FRAMES = 24;
const ENTRY_FRAMES = 20;
const PROGRESS_SPEED = 0.7;

/* ── Helpers ── */

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/* ── Play/control icon SVGs (matching Font Awesome solid icons from original) ── */

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

/* ── Main component ── */

export const CardCarousel: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  /* Entry fade */
  const entryOpacity = interpolate(frame, [0, ENTRY_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const entryScale = interpolate(frame, [0, ENTRY_FRAMES], [0.95, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  /* Background animation (matches @keyframes slidein exactly)
     0%,100%: background-position: 20% 0%; background-size: 3400px
     50%:     background-position: 100% 0%; background-size: 2400px
     animation: slidein 120s forwards infinite alternate */
  const bgProgress = (frame % BG_CYCLE_FRAMES) / BG_CYCLE_FRAMES;
  const bgT = bgProgress < 0.5 ? bgProgress * 2 : 2 - bgProgress * 2;
  const bgX = interpolate(bgT, [0, 1], [20, 100]);
  const bgSize = interpolate(bgT, [0, 1], [3400, 2400]);

  /* Current slide index (auto-advance, matching initialSlide: 3) */
  const totalCycleFrames = SLIDE_HOLD * SONGS.length;
  const cycleFrame = frame % totalCycleFrames;
  const rawSlideIndex = cycleFrame / SLIDE_HOLD;
  const currentSlideInt = Math.floor(rawSlideIndex);
  const slideTransitionProgress = rawSlideIndex - currentSlideInt;

  const transitionT = clamp(
    (slideTransitionProgress * SLIDE_HOLD - (SLIDE_HOLD - TRANSITION_FRAMES)) /
      TRANSITION_FRAMES,
    0,
    1,
  );
  const easedT = Easing.inOut(Easing.cubic)(transitionT);

  const activeSlideFloat =
    (INITIAL_SLIDE + currentSlideInt + easedT) % SONGS.length;
  const activeSlideIndex =
    (INITIAL_SLIDE + currentSlideInt) % SONGS.length;
  const nextSlideIndex =
    (INITIAL_SLIDE + currentSlideInt + 1) % SONGS.length;

  /* Song info for music player (original: songName.textContent / artistName.textContent) */
  const currentSong = SONGS[activeSlideIndex];
  const nextSong = SONGS[nextSlideIndex];

  const textSwapT = clamp(easedT * 3 - 1, 0, 1);
  const displayTitle = textSwapT > 0.5 ? nextSong.title : currentSong.title;
  const displayArtist = textSwapT > 0.5 ? nextSong.name : currentSong.name;
  const textOpacity = textSwapT > 0.5
    ? interpolate(textSwapT, [0.5, 1], [0, 1])
    : interpolate(textSwapT, [0, 0.5], [1, 0.3]);

  /* Progress bar */
  const progressValue = interpolate(slideTransitionProgress, [0, 0.85], [0, PROGRESS_SPEED], {
    extrapolateRight: "clamp",
  });

  /* Layout: cards positioned to match .swiper { padding: 40px 0 100px } */
  const centerX = width / 2;
  const swiperTop = (height - CARD_SIZE - SWIPER_PADDING_TOP - SWIPER_PADDING_BOTTOM - 260) / 2 + SWIPER_PADDING_TOP;
  const centerY = swiperTop + CARD_SIZE / 2;

  /* Carousel card geometry */
  const cards = useMemo(() => {
    return SONGS.map((song, i) => {
      const offset = i - activeSlideFloat;
      const wrappedOffset =
        offset > SONGS.length / 2
          ? offset - SONGS.length
          : offset < -SONGS.length / 2
            ? offset + SONGS.length
            : offset;

      const absOffset = Math.abs(wrappedOffset);

      // Swiper coverflow transforms (matching coverflowEffect config exactly)
      const rotateY =
        -wrappedOffset * COVERFLOW_ROTATE * COVERFLOW_MODIFIER;

      const translateZ =
        -absOffset * COVERFLOW_DEPTH * COVERFLOW_MODIFIER;

      const translateX =
        wrappedOffset * (CARD_SIZE + SPACE_BETWEEN) +
        wrappedOffset * COVERFLOW_STRETCH * COVERFLOW_MODIFIER;

      const scale = interpolate(absOffset, [0, 1, 3], [1, 0.92, 0.85], {
        extrapolateRight: "clamp",
      });

      const opacity = interpolate(absOffset, [0, 2.5, 4], [1, 0.7, 0.3], {
        extrapolateRight: "clamp",
      });

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

  return (
    <AbsoluteFill
      style={{
        opacity: entryOpacity,
        transform: `scale(${entryScale})`,
      }}
    >
      {/* Background: original bg.jpg with @keyframes slidein animation */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${staticFile("compositions/card-carousel/bg.jpg")})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: `${bgX}% 0%`,
          backgroundSize: `${bgSize}px`,
        }}
      />

      {/* Backdrop blur (original: backdrop-filter: blur(8px) on body) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Card carousel */}
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
            const { song, index, translateX, translateZ, rotateY, scale, opacity, zIndex } = card;

            return (
              <div
                key={index}
                style={{
                  position: "absolute",
                  left: centerX - CARD_SIZE / 2,
                  top: centerY - CARD_SIZE / 2,
                  width: CARD_SIZE,
                  height: CARD_SIZE,
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
                {/* Album cover image (original: .swiper-slide img) */}
                <Img
                  src={song.img}
                  style={{
                    width: CARD_SIZE,
                    height: CARD_SIZE,
                    objectFit: "cover",
                    borderRadius: CARD_RADIUS,
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />

                {/* Reflection: original uses -webkit-box-reflect: below -5px
                    linear-gradient(transparent, transparent, rgba(0, 0, 0, 0.4))
                    Remotion renders via Puppeteer/Chrome so box-reflect works,
                    but for safety we simulate it with a flipped duplicate. */}
                <div
                  style={{
                    position: "relative",
                    width: CARD_SIZE,
                    height: CARD_SIZE * 0.5,
                    marginTop: -5, // -5px gap from original box-reflect
                    overflow: "hidden",
                    transform: "scaleY(-1)",
                    transformOrigin: "top center",
                    borderRadius: CARD_RADIUS,
                    // Original gradient: linear-gradient(transparent, transparent, rgba(0, 0, 0, 0.4))
                    // Two transparent stops then 0.4 opacity black
                    maskImage:
                      "linear-gradient(to bottom, transparent 0%, transparent 33%, rgba(0, 0, 0, 0.4) 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to bottom, transparent 0%, transparent 33%, rgba(0, 0, 0, 0.4) 100%)",
                  }}
                >
                  <Img
                    src={song.img}
                    style={{
                      width: CARD_SIZE,
                      height: CARD_SIZE,
                      objectFit: "cover",
                      borderRadius: CARD_RADIUS,
                    }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Music player (original: .music-player) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: centerY + CARD_SIZE / 2 + SWIPER_PADDING_BOTTOM - 20,
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: PRIMARY_CLR,
          width: MUSIC_PLAYER_WIDTH,
          padding: "10px 30px",
          borderRadius: 20, // border-radius: 20px
        }}
      >
        {/* Title: original .music-player h1 — font-size: 1.5rem, font-weight: 600, line-height: 1.6 */}
        <div
          style={{
            fontSize: 24, // 1.5rem
            fontWeight: 600,
            color: PRIMARY_CLR,
            fontFamily: "'Nunito', sans-serif",
            lineHeight: 1.6,
            textAlign: "center",
            opacity: interpolate(textOpacity, [0.3, 1], [0.7, 1]),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: MUSIC_PLAYER_WIDTH - 60,
          }}
        >
          {displayTitle}
        </div>

        {/* Artist: original .music-player p — font-size: 1rem, font-weight: 400, opacity: 0.6 */}
        <div
          style={{
            fontSize: 16, // 1rem
            fontWeight: 400,
            color: PRIMARY_CLR,
            fontFamily: "'Nunito', sans-serif",
            opacity: 0.6 * interpolate(textOpacity, [0.3, 1], [0.6, 1]),
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: MUSIC_PLAYER_WIDTH - 60,
          }}
        >
          {displayArtist}
        </div>

        {/* Progress bar: original #progress — height: 7px, bg: rgba(163,162,164,0.4), margin: 32px 0 24px */}
        <div
          style={{
            width: "100%",
            height: PROGRESS_HEIGHT,
            background: PROGRESS_BG,
            borderRadius: 4,
            marginTop: 32,
            marginBottom: 24,
            position: "relative",
          }}
        >
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
          {/* Thumb: original 16px, rgba(163,162,164,0.9), outline: 4px solid var(--primary-clr) */}
          <div
            style={{
              position: "absolute",
              left: `${progressValue * 100}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: PROGRESS_THUMB_SIZE,
              height: PROGRESS_THUMB_SIZE,
              borderRadius: "50%",
              background: PROGRESS_THUMB_BG,
              outline: `4px solid ${PRIMARY_CLR}`,
              boxShadow: "0 6px 10px rgba(5, 36, 28, 0.3)",
            }}
          />
        </div>

        {/* Controls: original .controls button — 50px, margin: 20px, center button scale(1.3) */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Backward */}
          <div
            style={{
              width: CONTROL_SIZE,
              height: CONTROL_SIZE,
              margin: CONTROL_MARGIN,
              borderRadius: "50%",
              background: CONTROL_BG,
              border: `1px solid ${CONTROL_BORDER}`,
              boxShadow: CONTROL_SHADOW,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
            }}
          >
            <BackwardIcon />
          </div>

          {/* Play/Pause — original: transform: scale(1.3), no animation */}
          <div
            style={{
              width: CONTROL_SIZE,
              height: CONTROL_SIZE,
              margin: CONTROL_MARGIN,
              borderRadius: "50%",
              background: CONTROL_BG,
              border: `1px solid ${CONTROL_BORDER}`,
              boxShadow: CONTROL_SHADOW,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${CENTER_BUTTON_SCALE})`,
              fontSize: "1.1rem",
            }}
          >
            <PlayIcon size={20} />
          </div>

          {/* Forward */}
          <div
            style={{
              width: CONTROL_SIZE,
              height: CONTROL_SIZE,
              margin: CONTROL_MARGIN,
              borderRadius: "50%",
              background: CONTROL_BG,
              border: `1px solid ${CONTROL_BORDER}`,
              boxShadow: CONTROL_SHADOW,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
            }}
          >
            <ForwardIcon />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
