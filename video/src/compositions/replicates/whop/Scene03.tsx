import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
  staticFile,
} from "remotion";

/* ─────────── constants (4K: 3840x2160) ─────────── */
const MODAL_W = 1120;
const MODAL_RADIUS = 28;
const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/* ─────────── Typing animation data ─────────── */
const TYPING_STEPS = [
  { text: "$", frame: 0, caret: true },
  { text: "$3", frame: 10, caret: true },
  { text: "$39,", frame: 18, caret: true },
  { text: "$39,7", frame: 24, caret: true },
  { text: "$39,79", frame: 30, caret: true },
  { text: "$39,790", frame: 36, caret: true },
  { text: "$39,790.", frame: 42, caret: true },
  { text: "$39,790.9", frame: 48, caret: true },
  { text: "$39,790.92", frame: 54, caret: true },
  { text: "$39,790.92", frame: 64, caret: false },
];

/* ─────────── Sub-components ─────────── */

const USFlag: React.FC<{ size?: number }> = ({ size = 88 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      border: "3px solid #e5e7eb",
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#fff",
      }}
    >
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${(i / 13) * 100}%`,
            left: 0,
            right: 0,
            height: `${(1 / 13) * 100}%`,
            background: "#B22234",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "45%",
          height: `${(7 / 13) * 100}%`,
          background: "#3C3B6E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "#fff", fontSize: size * 0.18, lineHeight: 1 }}>
          {"\u2605\u2605"}
        </span>
      </div>
    </div>
  </div>
);

const TetherLogo: React.FC<{ size?: number }> = ({ size = 88 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: "#26A17B",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <svg
      width={size * 0.55}
      height={size * 0.55}
      viewBox="0 0 32 32"
      fill="none"
    >
      <rect x="6" y="7" width="20" height="3.5" rx="1.75" fill="#fff" />
      <rect x="14.25" y="10" width="3.5" height="16" rx="1.75" fill="#fff" />
    </svg>
  </div>
);

const Chevron: React.FC = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
    <path
      d="M9 6L15 12L9 18"
      stroke="#ccc"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const InfoIcon: React.FC = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    style={{ marginLeft: 10, opacity: 0.35 }}
  >
    <circle cx="12" cy="12" r="10" stroke="#888" strokeWidth="1.8" />
    <path
      d="M12 16V12M12 8H12.01"
      stroke="#888"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const CursorPointer: React.FC<{
  x: number;
  y: number;
  clicking?: boolean;
  hand?: boolean;
}> = ({ x, y, clicking, hand }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      zIndex: 100,
      transform: clicking ? "scale(0.82)" : "scale(1)",
      pointerEvents: "none",
    }}
  >
    {hand ? (
      <svg width="64" height="80" viewBox="0 0 28 36" fill="none">
        <path
          d="M12 3C12 1.9 12.9 1 14 1C15.1 1 16 1.9 16 3V16H12V3Z"
          fill="#fff"
          stroke="#333"
          strokeWidth="1.3"
        />
        <path
          d="M16 10C16 8.9 16.9 8 18 8C19.1 8 20 8.9 20 10V18H16V10Z"
          fill="#fff"
          stroke="#333"
          strokeWidth="1.3"
        />
        <path
          d="M20 12C20 10.9 20.9 10 22 10C23.1 10 24 10.9 24 12V18H20V12Z"
          fill="#fff"
          stroke="#333"
          strokeWidth="1.3"
        />
        <path
          d="M8 18C8 16.9 8.9 16 10 16H24V26C24 30.4 20.4 34 16 34H14C10.1 34 8 31 8 27V18Z"
          fill="#fff"
          stroke="#333"
          strokeWidth="1.3"
        />
        <path
          d="M8 20C6 19 4.5 18 4 17C3.5 16 4 15 5 14.5C6 14 7 14.5 8 16"
          fill="#fff"
          stroke="#333"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ) : (
      <svg width="72" height="84" viewBox="0 0 24 28" fill="none">
        <path
          d="M5 2L5 19L9.5 15L13.5 22L16.5 20.5L12.5 13.5L18 13L5 2Z"
          fill="#fff"
          stroke="#222"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    )}
  </div>
);

/* ─────────── Dashboard background from reference screenshot ─────────── */
const DASHBOARD_BG_SRC = staticFile(
  "compositions/replicate-whop/dashboard-bg.png",
);

const DashboardBG: React.FC<{
  blur?: number;
  brightness?: number;
  useScreenshot?: boolean;
}> = ({ blur = 0, brightness = 1, useScreenshot = false }) => {
  if (useScreenshot) {
    return (
      <AbsoluteFill
        style={{
          filter:
            blur > 0 || brightness < 1
              ? `blur(${blur}px) brightness(${brightness})`
              : undefined,
          transform: blur > 0 ? "scale(1.02)" : undefined,
        }}
      >
        <Img
          src={DASHBOARD_BG_SRC}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    );
  }

  /* Synthetic dashboard — pre-transfer state, matching reference amounts */
  return (
    <AbsoluteFill
      style={{
        background: "#b0b1b5",
        filter:
          blur > 0 || brightness < 1
            ? `blur(${blur}px) brightness(${brightness})`
            : undefined,
        transform: blur > 0 ? "scale(1.02)" : undefined,
      }}
    >
      {/* White content card */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 360,
          right: 0,
          bottom: 0,
          background: "#fff",
          borderRadius: "0 0 0 0",
        }}
      />
      {/* Left sidebar gray strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 360,
          bottom: 0,
          background: "#e8e9ec",
          borderRight: "1px solid #e0e0e3",
        }}
      />

      {/* Top area with balance */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 440,
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#999",
            marginBottom: 8,
            fontWeight: 400,
          }}
        >
          Total balance
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, color: "#111" }}>
          $42,740.24 USD
        </div>
      </div>

      {/* Action buttons */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 480,
          display: "flex",
          gap: 12,
          fontFamily: FONT,
        }}
      >
        {[
          { label: "+ Deposit", icon: true },
          { label: "Withdraw", icon: false },
          { label: "Move", icon: false },
        ].map(({ label }) => (
          <div
            key={label}
            style={{
              padding: "16px 32px",
              borderRadius: 24,
              background: "#fff",
              color: "#3b5afe",
              fontSize: 28,
              fontWeight: 600,
              border: "1.5px solid #e0e0e0",
            }}
          >
            {label}
          </div>
        ))}
        {/* Three-dot menu */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: "#fff",
            border: "1.5px solid #e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: "#999",
          }}
        >
          ···
        </div>
      </div>

      {/* Blue/green progress bar */}
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 440,
          right: 440,
        }}
      >
        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginBottom: 10,
            fontSize: 24,
            fontFamily: FONT,
          }}
        >
          <span style={{ color: "#3b5afe" }}>● Available cash</span>
          <span style={{ color: "#22c55e" }}>● Treasury</span>
        </div>
        <div style={{ height: 24, borderRadius: 12, background: "#e5e7eb" }}>
          <div
            style={{
              display: "flex",
              height: "100%",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ width: "78%", background: "#3b5afe" }} />
            <div style={{ width: "4%", background: "#22c55e" }} />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 60,
            marginTop: 8,
            fontFamily: FONT,
          }}
        >
          <span style={{ fontSize: 26, color: "#3b5afe", fontWeight: 500 }}>
            $39,790.92
          </span>
          <span style={{ fontSize: 26, color: "#22c55e", fontWeight: 500 }}>
            $1,478.00
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          position: "absolute",
          top: 380,
          left: 440,
          display: "flex",
          gap: 48,
          fontSize: 30,
          fontFamily: FONT,
          borderBottom: "1px solid #eee",
          paddingBottom: 0,
        }}
      >
        {["Balances", "All activity", "Withdrawals", "Top ups"].map((t, i) => (
          <span
            key={t}
            style={{
              fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? "#111" : "#999",
              borderBottom: i === 0 ? "3px solid #111" : "none",
              paddingBottom: 14,
            }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Treasury section */}
      <div
        style={{
          position: "absolute",
          top: 460,
          left: 440,
          fontFamily: FONT,
          right: 440,
        }}
      >
        {/* Convert link */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 24, color: "#3b5afe", fontWeight: 500 }}>
            ⇄ Convert
          </span>
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#111",
            marginBottom: 24,
          }}
        >
          Treasury
        </div>
        {/* USDT row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 30,
            color: "#333",
            padding: "12px 0",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: "#26A17B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}
            >
              ₮
            </span>
          </div>
          <span style={{ fontWeight: 600 }}>USDT</span>
          <span
            style={{
              background: "#dcfce7",
              color: "#22c55e",
              padding: "2px 10px",
              borderRadius: 10,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            6% APY
          </span>
          <span style={{ fontSize: 24, color: "#999" }}>ⓘ</span>
          <span style={{ marginLeft: "auto" }}>↻ $0.00</span>
          <span style={{ fontSize: 22, color: "#999", marginLeft: 4 }}>
            ›
          </span>
        </div>
        <div style={{ fontSize: 22, color: "#999", paddingLeft: 56 }}>
          USDT 0.00
        </div>
        {/* Gold row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 30,
            color: "#333",
            padding: "16px 0 4px",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 18 }}>●</span>
          </div>
          <span style={{ fontWeight: 600 }}>Gold</span>
          <span style={{ marginLeft: "auto", fontWeight: 600 }}>
            $1,478.43
          </span>
          <span style={{ fontSize: 22, color: "#999", marginLeft: 4 }}>
            ›
          </span>
        </div>
        <div style={{ fontSize: 22, color: "#999", paddingLeft: 56 }}>
          XAUT 0.310316
        </div>
      </div>

      {/* Cash section */}
      <div
        style={{
          position: "absolute",
          top: 780,
          left: 440,
          fontFamily: FONT,
          right: 440,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 24, color: "#3b5afe", fontWeight: 500 }}>
            ⇄ Convert
          </span>
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#111",
            marginBottom: 24,
          }}
        >
          Cash
        </div>
        {[
          {
            cur: "USD",
            amount: "$39,790.92",
            flag: "🇺🇸",
          },
          {
            cur: "EUR",
            amount: "$847.32",
            sub: "EUR €779.44",
            flag: "🇪🇺",
          },
          {
            cur: "CAD",
            amount: "$623.57",
            sub: "CAD $854.19",
            flag: "🇨🇦",
          },
        ].map((row) => (
          <div key={row.cur}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontSize: 30,
                color: "#333",
                padding: "10px 0 2px",
              }}
            >
              <span style={{ fontSize: 32 }}>{row.flag}</span>
              <span style={{ fontWeight: 600 }}>{row.cur}</span>
              <span style={{ marginLeft: "auto", fontWeight: 600 }}>
                {row.amount}
              </span>
              <span
                style={{ fontSize: 22, color: "#999", marginLeft: 4 }}
              >
                ›
              </span>
            </div>
            {row.sub && (
              <div style={{ fontSize: 22, color: "#999", paddingLeft: 50 }}>
                {row.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ─────────── Phase 1: Transfer input modal ─────────── */
const TransferModal: React.FC<{
  frame: number;
  fps: number;
  typedAmount: string;
  caretVisible: boolean;
  opacity: number;
}> = ({ frame, fps, typedAmount, caretVisible, opacity }) => (
  <div
    style={{
      width: MODAL_W,
      background: "#fff",
      borderRadius: MODAL_RADIUS,
      boxShadow:
        "0 12px 40px rgba(0,0,0,0.15), 0 2px 12px rgba(0,0,0,0.06)",
      border: "1px solid rgba(0,0,0,0.08)",
      padding: "52px 68px 56px",
      display: "flex",
      flexDirection: "column",
      opacity,
      fontFamily: FONT,
    }}
  >
    {/* Header */}
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 44,
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: "#111",
          letterSpacing: -0.3,
        }}
      >
        Transfer
      </div>
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        style={{ position: "absolute", right: 0, cursor: "pointer" }}
      >
        <path
          d="M18 6L6 18M6 6L18 18"
          stroke="#bbb"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>

    {/* Amount */}
    <div
      style={{
        fontSize: 76,
        fontWeight: 700,
        color: "#111",
        marginBottom: 40,
        letterSpacing: -1.5,
        lineHeight: 1.1,
        display: "flex",
        alignItems: "center",
      }}
    >
      {typedAmount}
      {caretVisible && (
        <div
          style={{
            width: 2.5,
            height: 58,
            background: "#333",
            marginLeft: 2,
            borderRadius: 1.25,
          }}
        />
      )}
    </div>

    {/* USD row */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "28px 0",
        borderTop: "1.5px solid #f0f0f0",
        gap: 18,
      }}
    >
      <USFlag size={52} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 34, fontWeight: 600, color: "#111" }}>USD</div>
        <div style={{ fontSize: 24, color: "#999", marginTop: 3 }}>
          $39,790.92 USD available
        </div>
      </div>
      <Chevron />
    </div>

    {/* Down arrow */}
    <div style={{ padding: "10px 0", paddingLeft: 14 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 6V18"
          stroke="#ccc"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M7 13L12 18L17 13"
          stroke="#ccc"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>

    {/* USDT row */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "28px 0",
        gap: 18,
      }}
    >
      <TetherLogo size={52} />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 34, fontWeight: 600, color: "#111" }}>
            USDT
          </span>
          <InfoIcon />
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#26A17B",
            marginTop: 3,
            fontWeight: 500,
          }}
        >
          Earns up to 6%
        </div>
      </div>
      <Chevron />
    </div>

    {/* Review button */}
    <div
      style={{
        marginTop: 36,
        background: "#3b5afe",
        borderRadius: 40,
        padding: "28px 0",
        textAlign: "center" as const,
        fontSize: 30,
        fontWeight: 700,
        color: "#fff",
        letterSpacing: 0.3,
      }}
    >
      Review
    </div>
  </div>
);

/* ─────────── Phase 2: Review transfer confirmation ─────────── */
const ReviewModal: React.FC<{
  opacity: number;
  confirmed: boolean;
  confirmProgress: number;
}> = ({ opacity, confirmed, confirmProgress }) => {
  const buttonBg = confirmed
    ? interpolate(confirmProgress, [0, 1], [0, 1], {
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <div
      style={{
        width: MODAL_W,
        background: "#fff",
        borderRadius: MODAL_RADIUS,
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.15), 0 2px 12px rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.08)",
        padding: "40px 52px 36px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
        fontFamily: FONT,
      }}
    >
      {/* Title — "Review" bold, "transfer" lighter like reference */}
      <div
        style={{
          fontSize: 34,
          marginBottom: 24,
          letterSpacing: -0.3,
        }}
      >
        <span style={{ fontWeight: 700, color: "#111" }}>Review</span>{" "}
        <span style={{ fontWeight: 400, color: "#888" }}>transfer</span>
      </div>

      {/* Flag -> arrow -> Tether */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <USFlag size={52} />
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12H19M19 12L13 6M19 12L13 18"
            stroke="#999"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <TetherLogo size={52} />
      </div>

      {/* Transfer heading */}
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          color: "#111",
          marginBottom: 28,
          textAlign: "center" as const,
          letterSpacing: -0.5,
        }}
      >
        Transfer $39,790.92 to Treasury
      </div>

      {/* Details */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          borderTop: "1.5px solid #eee",
        }}
      >
        {[
          { label: "Exchange rate", value: "$1.00 USD \u2248 $1.00 USDT" },
          { label: "Amount received", value: "$39,790.92" },
          { label: "Estimated time", value: "A few seconds" },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 28,
              padding: "14px 0",
              borderBottom: "1px solid #f3f3f3",
            }}
          >
            <span style={{ color: "#999" }}>{row.label}</span>
            <span style={{ color: "#111", fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div
        style={{
          fontSize: 20,
          color: "#aaa",
          textAlign: "center" as const,
          marginTop: 24,
          lineHeight: 1.5,
          maxWidth: 800,
        }}
      >
        By clicking &quot;Confirm transfer&quot; you will transfer funds to your
        self-hosted wallet where they will be converted to USDT.
      </div>

      {/* Confirm button */}
      <div
        style={{
          marginTop: 28,
          width: "100%",
          position: "relative",
          overflow: "hidden",
          background: "#3b5afe",
          borderRadius: 40,
          padding: "26px 0",
          textAlign: "center" as const,
          fontSize: 32,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: 0.3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        {confirmed && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#22c55e",
              borderRadius: 40,
              opacity: buttonBg,
            }}
          />
        )}
        <span
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          {confirmed && confirmProgress >= 0.8 ? (
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.3)" />
              <path
                d="M7.5 12L10.5 15L16.5 9"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            "Confirm transfer"
          )}
        </span>
      </div>
    </div>
  );
};

/* ─────────── Main Scene ─────────── */
export const Scene03: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── Timeline (132 frames = 5.28s at 25fps) ──
   * 0-8:     Modal slides in + fades in
   * 8-64:    Amount types character by character
   * 64-72:   Cursor moves to Review button
   * 72-76:   Click Review
   * 76-82:   Crossfade to Review modal
   * 82-98:   Review modal visible, cursor moves to Confirm
   * 98-102:  Click Confirm
   * 102-112: Button turns green with checkmark
   * 112-120: Hold confirmed state
   * 120-132: Modal fades out, return to dashboard
   */

  // Modal entrance spring
  const modalEntrance = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 140, mass: 0.7 },
  });
  const modalY = interpolate(modalEntrance, [0, 1], [60, 0]);
  const modalOpacity = interpolate(frame, [0, 4], [0.6, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Modal exit
  const modalExit = interpolate(frame, [118, 126], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Overlay — calibrated to match reference brightness
  const overlayOpacity = interpolate(
    frame,
    [0, 3, 118, 126],
    [0.30, 0.45, 0.45, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Typing with blinking caret
  let typedAmount = "$";
  let showCaret = true;
  for (const step of TYPING_STEPS) {
    if (frame >= step.frame) {
      typedAmount = step.text;
      showCaret = step.caret;
    }
  }
  const caretVisible = showCaret && Math.floor(frame / 7) % 2 === 0;

  // Phase switching
  const REVIEW_START = 76;
  const REVIEW_FADE = 3;
  const transferOpacity = interpolate(
    frame,
    [REVIEW_START, REVIEW_START + REVIEW_FADE],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const reviewOpacity = interpolate(
    frame,
    [REVIEW_START + 1, REVIEW_START + REVIEW_FADE + 1],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Confirm
  const CONFIRM_CLICK = 100;
  const confirmed = frame >= CONFIRM_CLICK;
  const confirmProgress = interpolate(
    frame,
    [CONFIRM_CLICK, CONFIRM_CLICK + 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Cursor anchor near modal center — modal is at center + offset
  // Modal center: 1920 - 70 = 1850 (x), 1080 - 300 = 780 (y)
  const modalCX = 1850;
  const modalCY = 780;

  // Cursor
  const cursorX = interpolate(
    frame,
    [0, 8, 60, 68, 74, 82, 96, 102],
    [
      modalCX + 180,
      modalCX + 140,
      modalCX + 80,
      modalCX + 20,
      modalCX,
      modalCX,
      modalCX + 20,
      modalCX + 20,
    ],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    },
  );
  const cursorY = interpolate(
    frame,
    [0, 8, 60, 66, 74, 82, 94, 102],
    [
      modalCY - 160,
      modalCY - 140,
      modalCY + 20,
      modalCY + 240,
      modalCY + 280,
      modalCY + 160,
      modalCY + 280,
      modalCY + 300,
    ],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    },
  );

  const isClicking =
    (frame >= 73 && frame <= 76) ||
    (frame >= CONFIRM_CLICK && frame <= CONFIRM_CLICK + 3);

  const isHand =
    (frame >= 68 && frame <= 77) ||
    (frame >= 93 && frame <= CONFIRM_CLICK + 5);

  const combinedModalOpacity = modalOpacity * modalExit;

  // Dashboard blur — moderate blur during modal phase, clears at end
  const dashBlur = interpolate(frame, [118, 128], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dashBright = interpolate(frame, [118, 128], [0.93, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitSlide =
    frame > 118
      ? interpolate(frame, [118, 126], [0, 40], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#a8a9ad" }}>
      <DashboardBG blur={dashBlur} brightness={dashBright} />

      <AbsoluteFill
        style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
      />

      {/* Modal container */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateX(${-70}px) translateY(${-300 + modalY - exitSlide}px)`,
        }}
      >
        {frame < REVIEW_START + REVIEW_FADE + 2 && (
          <div style={{ position: "absolute" }}>
            <TransferModal
              frame={frame}
              fps={fps}
              typedAmount={typedAmount}
              caretVisible={caretVisible}
              opacity={transferOpacity * combinedModalOpacity}
            />
          </div>
        )}

        {frame >= REVIEW_START && (
          <div style={{ position: "absolute" }}>
            <ReviewModal
              opacity={reviewOpacity * combinedModalOpacity}
              confirmed={confirmed}
              confirmProgress={confirmProgress}
            />
          </div>
        )}
      </AbsoluteFill>

      {frame >= 5 && frame < 118 && (
        <CursorPointer
          x={cursorX}
          y={cursorY}
          clicking={isClicking}
          hand={isHand}
        />
      )}
    </AbsoluteFill>
  );
};

export const scene03Meta = {
  id: "WhopScene03",
  component: Scene03,
  width: 3840,
  height: 2160,
  fps: 25,
  durationInFrames: 132,
};
