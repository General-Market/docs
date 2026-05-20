// A phone slides in from the wings, unrotates, then eleven widgets fly out
// from its sternum to the addresses they were assigned at birth. The source
// was a ScrollTrigger.pin: each pixel of scroll spent another beat of a six
// second master timeline. Strip out the scroll and you keep the choreography.
// The frame clock has replaced the wheel; the dance was always the point.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// Master timeline runs six seconds, then the scene holds while the widgets
// sit in their final scattered positions. Mapped to 85% of t, 15% rest.
const TOTAL_SEC = 6;
const ACTIVE_FRACTION = 0.85;

const WIDGET_START = 2; // when widgets become visible + start their own clocks
const WIDGET_DURATION = 3;

// Power4.easeOut and Power2.easeOut — built from poly.
const power4Out = Easing.out(Easing.poly(4));
const power2Out = Easing.out(Easing.poly(2));

type Ease = (x: number) => number;

type Widget = {
  id: string;
  x: number;
  y: number;
  scale: number;
  ease: Ease;
};

// Order matters: index % 3 picks the stagger offset (0, 0.5, 1.0 seconds).
const WIDGETS: Widget[] = [
  { id: "app-store",   x: 500,  y: 100,  scale: 0.9, ease: power4Out }, // 0 → 2.0s
  { id: "screen-time", x: -500, y: -300, scale: 0.9, ease: power2Out }, // 1 → 2.5s
  { id: "weather",     x: -400, y: 350,  scale: 1.1, ease: power4Out }, // 2 → 3.0s
  { id: "stocks",      x: 530,  y: -170, scale: 0.9, ease: power4Out }, // 3 → 2.0s
  { id: "fitness",     x: -350, y: -100, scale: 1.1, ease: power2Out }, // 4 → 2.5s
  { id: "find-my",     x: 400,  y: -360, scale: 1.1, ease: power4Out }, // 5 → 3.0s
  { id: "calendar",    x: -630, y: 0,    scale: 0.9, ease: power2Out }, // 6 → 2.0s
  { id: "wallet",      x: -280, y: 100,  scale: 1.0, ease: power4Out }, // 7 → 2.5s
  { id: "apple-tv",    x: 500,  y: 300,  scale: 1.0, ease: power4Out }, // 8 → 3.0s
  { id: "sleep",       x: 270,  y: -50,  scale: 0.9, ease: power2Out }, // 9 → 2.0s
  { id: "socials",     x: 330,  y: 120,  scale: 1.0, ease: power2Out }, // 10 → 2.5s
];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const IPhoneWidgets: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Map scene frame onto the six-second master clock, holding at the end.
  const t = clamp01(frame / Math.max(1, durationInFrames - 1));
  const sec = (t / ACTIVE_FRACTION) * TOTAL_SEC;
  const frameSec = Math.min(sec, TOTAL_SEC);

  // iPhone — slide, then unrotate + shrink, then grow to final size.
  const phoneX = interpolate(frameSec, [0, 1], [-450, 0], {
    extrapolateRight: "clamp",
  });
  const phoneRot = interpolate(frameSec, [1, 2], [90, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneScale = interpolate(frameSec, [0, 1, 2, 5], [1, 1, 0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d0d0d",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Soft halo behind the phone, just to keep the dark from swallowing it */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(120,120,140,0.18) 0%, rgba(0,0,0,0) 60%)",
          filter: "blur(40px)",
        }}
      />

      {/* Widgets — rendered behind the phone (z-index -1 in the source) */}
      {WIDGETS.map((w, i) => {
        const startTime = WIDGET_START + ((i % 3) * 0.5);
        const localT = clamp01((frameSec - startTime) / WIDGET_DURATION);
        const eased = w.ease(localT);
        const x = eased * w.x;
        const y = eased * w.y;
        const scale = eased * w.scale;
        const opacity = frameSec >= startTime ? 1 : 0;
        return (
          <div
            key={w.id}
            style={{
              position: "absolute",
              transform: `translate(${x}px, ${y}px) scale(${scale})`,
              opacity,
              zIndex: 1,
            }}
          >
            <WidgetCard id={w.id} />
          </div>
        );
      })}

      {/* iPhone — sits on top of the widgets */}
      <div
        style={{
          position: "absolute",
          transform: `translateX(${phoneX}px) rotate(${phoneRot}deg) scale(${phoneScale})`,
          zIndex: 2,
        }}
      >
        <IPhone />
      </div>

      {/* Suppress the 'fps unused' note without changing behavior */}
      <span style={{ display: "none" }}>{fps}</span>
    </AbsoluteFill>
  );
};

// ── iPhone ───────────────────────────────────────────────────────────────────

const IPhone: React.FC = () => {
  const W = 280;
  const H = 580;
  return (
    <div
      style={{
        width: W,
        height: H,
        borderRadius: 50,
        background:
          "linear-gradient(150deg, #2a2a2e 0%, #1a1a1c 50%, #0c0c0d 100%)",
        boxShadow:
          "0 40px 80px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.04), inset 0 0 0 1px rgba(255,255,255,0.06)",
        position: "relative",
        padding: 10,
        boxSizing: "border-box",
      }}
    >
      {/* Screen */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 42,
          background:
            "linear-gradient(160deg, #1c1c20 0%, #0a0a0c 50%, #050507 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle screen reflection */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "60%",
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.0) 60%)",
            pointerEvents: "none",
          }}
        />
        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            width: 110,
            height: 30,
            background: "#000",
            borderRadius: 18,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
          }}
        />
      </div>
    </div>
  );
};

// ── Widgets ──────────────────────────────────────────────────────────────────

const CARD = 170;

const cardBase: React.CSSProperties = {
  width: CARD,
  height: CARD,
  borderRadius: 30,
  boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
  overflow: "hidden",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif",
  color: "#fff",
};

const WidgetCard: React.FC<{ id: string }> = ({ id }) => {
  switch (id) {
    case "app-store":
      return (
        <div
          style={{
            ...cardBase,
            background: "linear-gradient(160deg, #00b8ff 0%, #006fff 100%)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              fontStyle: "italic",
              letterSpacing: "-0.05em",
              lineHeight: 1,
              textShadow: "0 4px 14px rgba(0,0,0,0.3)",
            }}
          >
            A
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.95, marginTop: 4 }}>
            App Store
          </div>
        </div>
      );

    case "screen-time":
      return (
        <div
          style={{
            ...cardBase,
            background: "linear-gradient(160deg, #6a47ff 0%, #b245ff 100%)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>
            Screen Time
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <svg viewBox="0 0 100 100" width={104} height={104}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#fff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="180 264"
                transform="rotate(-90 50 50)"
              />
              <text
                x="50"
                y="56"
                textAnchor="middle"
                fontSize="20"
                fontWeight="700"
                fill="#fff"
              >
                4h
              </text>
            </svg>
          </div>
        </div>
      );

    case "weather":
      return (
        <div
          style={{
            ...cardBase,
            background:
              "linear-gradient(170deg, #4ab3ff 0%, #1e6dd8 60%, #143d80 100%)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.95 }}>
            Cupertino
          </div>
          <div style={{ fontSize: 46, fontWeight: 300, marginTop: 4, letterSpacing: "-0.02em" }}>
            72°
          </div>
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 38,
              height: 38,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #ffe066 0%, #ffb84d 60%, transparent 70%)",
              boxShadow: "0 0 30px rgba(255,200,80,0.6)",
            }}
          />
          <div style={{ marginTop: "auto", fontSize: 11, fontWeight: 600, opacity: 0.9 }}>
            Mostly Sunny
          </div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>H:75° L:58°</div>
        </div>
      );

    case "stocks":
      return (
        <div
          style={{
            ...cardBase,
            background: "linear-gradient(160deg, #1c1c1e 0%, #2c2c2e 100%)",
            padding: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>AAPL</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#30d158" }}>+1.42%</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>187.45</div>
          <svg
            viewBox="0 0 140 80"
            style={{ marginTop: 8, width: "100%", height: 80 }}
          >
            <polyline
              points="0,55 18,52 32,60 48,45 64,50 80,30 96,38 112,22 128,28 140,15"
              fill="none"
              stroke="#30d158"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points="0,65 18,68 32,62 48,70 64,66 80,58 96,62"
              fill="none"
              stroke="#ff453a"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.6"
            />
          </svg>
        </div>
      );

    case "calendar":
      return (
        <div
          style={{
            ...cardBase,
            background: "#fff",
            color: "#1c1c1e",
          }}
        >
          <div
            style={{
              background: "#ff3b30",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Mar 15
          </div>
          <div
            style={{
              flex: 1,
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 10, color: "#8e8e93", fontWeight: 600 }}>
              FRIDAY
            </div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>9:00 Standup</div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>11:30 Design</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#ff3b30" }}>
              3:00 Launch
            </div>
          </div>
        </div>
      );

    case "fitness":
      return (
        <div
          style={{
            ...cardBase,
            background: "#1c1c1e",
            padding: 16,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <svg viewBox="0 0 100 100" width={112} height={112}>
            {/* Move (red) */}
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(250,46,89,0.2)" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#fa2e59"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="220 264"
              transform="rotate(-90 50 50)"
            />
            {/* Exercise (green) */}
            <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(120,255,68,0.2)" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="30"
              fill="none"
              stroke="#a4ff3d"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="140 188"
              transform="rotate(-90 50 50)"
            />
            {/* Stand (blue) */}
            <circle cx="50" cy="50" r="18" fill="none" stroke="rgba(0,200,255,0.2)" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="18"
              fill="none"
              stroke="#00e0ff"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="70 113"
              transform="rotate(-90 50 50)"
            />
          </svg>
        </div>
      );

    case "find-my":
      return (
        <div
          style={{
            ...cardBase,
            background:
              "linear-gradient(160deg, #6cd0ff 0%, #2f7adf 60%, #1a3f80 100%)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700 }}>Find My</div>
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 80,
                height: 80,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)",
              }}
            />
            <svg viewBox="0 0 24 24" width={42} height={42}>
              <path
                d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"
                fill="#fff"
                stroke="#fff"
                strokeWidth="0.5"
              />
              <circle cx="12" cy="9" r="2.5" fill="#2f7adf" />
            </svg>
          </div>
          <div style={{ fontSize: 10, opacity: 0.9, fontWeight: 600 }}>
            Home · 2 min ago
          </div>
        </div>
      );

    case "sleep":
      return (
        <div
          style={{
            ...cardBase,
            background: "linear-gradient(170deg, #0c1a3a 0%, #1a2b5e 100%)",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.95 }}>
            Sleep
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <svg viewBox="0 0 100 100" width={70} height={70}>
              <path
                d="M65 20a35 35 0 1 0 25 60 28 28 0 0 1-25-60z"
                fill="#dde6ff"
              />
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>7h 42m</div>
        </div>
      );

    case "apple-tv":
      return (
        <div
          style={{
            ...cardBase,
            background: "#000",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: "-0.05em",
              lineHeight: 1,
            }}
          >
            tv
          </div>
          <div style={{ fontSize: 10, marginTop: 6, opacity: 0.6, fontWeight: 500 }}>
            Apple TV+
          </div>
        </div>
      );

    case "wallet":
      return (
        <div
          style={{
            ...cardBase,
            background: "#0a0a0a",
            padding: 16,
            justifyContent: "flex-end",
          }}
        >
          {/* Back card */}
          <div
            style={{
              position: "absolute",
              top: 30,
              left: 18,
              right: 18,
              height: 90,
              borderRadius: 12,
              background: "linear-gradient(135deg, #5a5a5a 0%, #2a2a2a 100%)",
              boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
            }}
          />
          {/* Front card */}
          <div
            style={{
              position: "absolute",
              top: 56,
              left: 12,
              right: 12,
              height: 90,
              borderRadius: 12,
              background:
                "linear-gradient(135deg, #ffd76b 0%, #c98a2a 60%, #6f4814 100%)",
              boxShadow: "0 6px 14px rgba(0,0,0,0.5)",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                width: 24,
                height: 18,
                borderRadius: 3,
                background: "rgba(255,255,255,0.4)",
              }}
            />
            <div style={{ fontSize: 9, fontWeight: 700, color: "#3a2400" }}>
              •••• 4242
            </div>
          </div>
        </div>
      );

    case "socials":
      return (
        <div
          style={{
            ...cardBase,
            background: "linear-gradient(180deg, #ff348b 0%, #e30217 100%)",
            padding: 0,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            𝕏
          </div>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            ✰
          </div>
        </div>
      );

    default:
      return null;
  }
};
