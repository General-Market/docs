import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";
import { Sfx } from "../components/Sfx";
import { TEXT_IN, TICK, PLOB, COUNT, REVEAL } from "../sfxMap";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

const CYCLE_IN = sec(10.56);
const CYCLE_OUT = sec(36.26);

const JOIN_AT = sec(7.9);
const ORACLE_AT = sec(15.8);
const SETTLE_AT = sec(22.0);

// Voice-synced stepped phases (local seconds from SettlementCard mount):
// Card appears at 100.4s global.
// Phase 1 (Join) plays from mount → JOIN_AT.
// ~7.9s local → voice says "bet" → step 1 ✓, phase 2 cross-fades in
// ~15.8s local → voice says "Oracle" → step 2 ✓, phase 3 cross-fades in
// ~22.0s local → voice says "compute PL" → step 3 ✓, holds
// Fade out ~25.7s local.

// ── Phase data ───────────────────────────────────────────────────────────

const BETTORS = [
  { label: "You", amount: "$50", side: "YES" as const },
  { label: "Trader B", amount: "$120", side: "NO" as const },
  { label: "Trader C", amount: "$45", side: "YES" as const },
  { label: "Trader D", amount: "$80", side: "NO" as const },
  { label: "Bot", amount: "$8", side: "YES" as const },
];

const ORACLE_STEPS = ["Observe", "Verify", "Sign"];

const PAYOUTS = [
  { label: "You", amount: "+$31.50" },
  { label: "Trader C", amount: "+$28.40" },
  { label: "Bot", amount: "+$5.10" },
];

// ── Phase 1: Join ────────────────────────────────────────────────────────

const JoinContent: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const rawFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = Math.max(0, rawFrame - startFrame);

  const poolValue = interpolate(frame, [sec(1), sec(5)], [0, 2346], {
    ...clamp,
    easing: EASE_OUT,
  });

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ ...TYPE.label, fontSize: 20, marginBottom: 2 }}>
          ENTERING POOL
        </div>
        {BETTORS.map((b, i) => {
          const s = spring({
            frame: Math.max(0, frame - sec(0.5 + i * 0.5)),
            fps,
            config: { damping: 16, stiffness: 160, mass: 0.5 },
          });
          return (
            <div
              key={b.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 14px",
                background: COLOR.lightSurface,
                borderRadius: 10,
                borderLeft: `3px solid ${b.side === "YES" ? COLOR.wiseGreen : COLOR.danger}`,
                opacity: s,
                transform: `translateX(${interpolate(s, [0, 1], [-16, 0], clamp)}px)`,
              }}
            >
              <span style={{ ...TYPE.bodySemibold, fontSize: 22 }}>{b.label}</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span
                  style={{
                    ...TYPE.body,
                    fontSize: 22,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {b.amount}
                </span>
                <span
                  style={{
                    ...TYPE.bodySemibold,
                    fontSize: 18,
                    color: b.side === "YES" ? COLOR.darkGreen : COLOR.danger,
                  }}
                >
                  {b.side}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          width: 130,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            background: COLOR.lightMint,
            border: `2px solid ${COLOR.wiseGreen}`,
            borderRadius: 20,
            padding: "16px 12px",
            textAlign: "center",
            width: "100%",
          }}
        >
          <div style={{ ...TYPE.label, fontSize: 16, marginBottom: 6 }}>POOL</div>
          <div
            style={{
              ...TYPE.statValue,
              fontSize: 26,
              color: COLOR.darkGreen,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${Math.round(poolValue).toLocaleString()}
          </div>
        </div>
        <div
          style={{ ...TYPE.caption, fontSize: 18, textAlign: "center" }}
        >
          Locked until settle
        </div>
      </div>
    </div>
  );
};

// ── Phase 2: Oracle ──────────────────────────────────────────────────────

const OracleContent: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const rawFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = Math.max(0, rawFrame - startFrame);

  const consensusDelay = sec(0.5 + ORACLE_STEPS.length * 1.2 + 0.6);
  const consensusSpring = spring({
    frame: Math.max(0, frame - consensusDelay),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.8 },
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 20,
          marginBottom: 20,
        }}
      >
        {ORACLE_STEPS.map((step, i) => {
          const delay = sec(0.5 + i * 1.2);
          const s = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 14, stiffness: 140, mass: 0.7 },
          });
          const isComplete = frame >= delay + sec(0.8);

          return (
            <div
              key={step}
              style={{
                flex: 1,
                maxWidth: 200,
                padding: "16px 12px",
                background: isComplete ? COLOR.lightMint : COLOR.lightSurface,
                border: `2px solid ${isComplete ? COLOR.wiseGreen : COLOR.border}`,
                borderRadius: 16,
                textAlign: "center",
                opacity: s,
                transform: `scale(${interpolate(s, [0, 1], [0.9, 1], clamp)})`,
              }}
            >
              <div
                style={{
                  ...TYPE.bodySemibold,
                  fontSize: 26,
                  color: isComplete ? COLOR.darkGreen : COLOR.nearBlack,
                  marginBottom: 4,
                }}
              >
                {isComplete ? "\u2713" : `${i + 1}`}
              </div>
              <div
                style={{
                  ...TYPE.bodySemibold,
                  fontSize: 20,
                  color: isComplete ? COLOR.darkGreen : COLOR.gray,
                }}
              >
                {step}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          opacity: consensusSpring,
          transform: `translateY(${interpolate(consensusSpring, [0, 1], [12, 0], clamp)}px)`,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: COLOR.lightMint,
            border: `2px solid ${COLOR.wiseGreen}`,
            borderRadius: 16,
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              background: COLOR.wiseGreen,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                ...TYPE.bodySemibold,
                fontSize: 15,
                color: COLOR.darkGreen,
              }}
            >
              {"\u2713"}
            </span>
          </div>
          <span
            style={{
              ...TYPE.bodySemibold,
              fontSize: 22,
              color: COLOR.darkGreen,
            }}
          >
            BLS Consensus Reached
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Phase 3: Settle ──────────────────────────────────────────────────────

const SettleContent: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const rawFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = Math.max(0, rawFrame - startFrame);

  const arrowProgress = interpolate(frame, [sec(0.3), sec(1.5)], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });

  const doneSpring = spring({
    frame: Math.max(0, frame - sec(3.5)),
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.8 },
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "stretch",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 110,
            background: COLOR.lightSurface,
            borderRadius: 16,
            padding: "14px 10px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ ...TYPE.label, fontSize: 15, marginBottom: 4 }}>
            POOL
          </div>
          <div style={{ ...TYPE.statValue, fontSize: 22 }}>$2,346</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            opacity: arrowProgress,
          }}
        >
          <div
            style={{
              width: interpolate(arrowProgress, [0, 1], [0, 36], clamp),
              height: 3,
              background: COLOR.wiseGreen,
              borderRadius: 2,
            }}
          />
          <span style={{ fontSize: 22, color: COLOR.wiseGreen }}>
            {"\u2192"}
          </span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              ...TYPE.label,
              fontSize: 18,
              color: COLOR.darkGreen,
              marginBottom: 2,
            }}
          >
            WINNERS
          </div>
          {PAYOUTS.map((p, i) => {
            const s = spring({
              frame: Math.max(0, frame - sec(1.2 + i * 0.4)),
              fps,
              config: { damping: 14, stiffness: 140, mass: 0.7 },
            });
            return (
              <div
                key={p.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 14px",
                  background: COLOR.lightMint,
                  borderRadius: 10,
                  opacity: s,
                  transform: `translateX(${interpolate(s, [0, 1], [16, 0], clamp)}px)`,
                }}
              >
                <span
                  style={{
                    ...TYPE.bodySemibold,
                    fontSize: 20,
                    color: COLOR.darkGreen,
                  }}
                >
                  {p.label}
                </span>
                <span
                  style={{
                    ...TYPE.bodySemibold,
                    fontSize: 20,
                    color: COLOR.wiseGreen,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {p.amount}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          opacity: doneSpring,
          transform: `scale(${interpolate(doneSpring, [0, 1], [0.85, 1], clamp)})`,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: COLOR.wiseGreen,
            borderRadius: 9999,
            padding: "8px 28px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              ...TYPE.bodySemibold,
              fontSize: 20,
              color: COLOR.darkGreen,
            }}
          >
            {"\u2713"} Settled in 10 minutes
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Main Card ────────────────────────────────────────────────────────────

const SettlementCard: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = CYCLE_OUT - CYCLE_IN;

  const row = (delay: number) => {
    const p = interpolate(frame - sec(delay), [0, sec(0.4)], [0, 1], {
      ...clamp,
      easing: EASE_OUT,
    });
    return { opacity: p, transform: `translateY(${(1 - p) * 12}px)` };
  };

  const SNAP = 5;
  const progress = interpolate(
    frame,
    [
      sec(0.5),
      JOIN_AT - SNAP,
      JOIN_AT,
      ORACLE_AT - SNAP,
      ORACLE_AT,
      SETTLE_AT - SNAP,
      SETTLE_AT,
    ],
    [0, 0, 33, 33, 66, 66, 100],
    clamp,
  );

  const steps = [
    { label: "Join", at: 5 },
    { label: "Oracle", at: 34 },
    { label: "Settle", at: 67 },
  ];

  const FADE = sec(0.6);
  const phase1Opacity = interpolate(
    frame,
    [sec(0.3), sec(0.3) + FADE, JOIN_AT - FADE, JOIN_AT + sec(0.3)],
    [0, 1, 1, 0],
    clamp,
  );
  const phase2Opacity = interpolate(
    frame,
    [JOIN_AT - sec(0.2), JOIN_AT + FADE, ORACLE_AT - FADE, ORACLE_AT + sec(0.3)],
    [0, 1, 1, 0],
    clamp,
  );
  const phase3Opacity = interpolate(
    frame,
    [ORACLE_AT - sec(0.2), ORACLE_AT + FADE, duration - sec(1.5), duration],
    [0, 1, 1, 0],
    clamp,
  );

  const exitOpacity = interpolate(frame, [duration - 15, duration], [1, 0], clamp);

  return (
    <DiagramCard>
      <div style={{ opacity: exitOpacity }}>
        {/* Hero */}
        <div style={{ ...row(0), marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ ...TYPE.displayHero, color: COLOR.wiseGreen }}>
              10 min
            </span>
            <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>
              settlement
            </span>
          </div>
        </div>

        {/* Progress bar with step labels */}
        <div style={{ ...row(0.15), marginBottom: 24 }}>
          <div
            style={{
              height: 8,
              background: COLOR.lightSurface,
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: COLOR.wiseGreen,
                borderRadius: 4,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            {steps.map((s) => (
              <span
                key={s.label}
                style={{
                  ...TYPE.bodySemibold,
                  fontSize: 22,
                  color: progress >= s.at ? COLOR.wiseGreen : COLOR.gray,
                }}
              >
                {progress >= s.at ? `\u2713 ${s.label}` : s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Phase content — stacked and cross-faded */}
        <div style={{ position: "relative", minHeight: 230, marginBottom: 16 }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              opacity: phase1Opacity,
            }}
          >
            <JoinContent startFrame={sec(0.3)} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              opacity: phase2Opacity,
            }}
          >
            <OracleContent startFrame={JOIN_AT} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              opacity: phase3Opacity,
            }}
          >
            <SettleContent startFrame={ORACLE_AT} />
          </div>
        </div>

        {/* Three green pills */}
        <div style={{ ...row(0.5), display: "flex", gap: 16 }}>
          {["$0 fees", "$0 spread", "No disputes"].map((f) => (
            <div
              key={f}
              style={{
                background: COLOR.lightMint,
                borderRadius: 9999,
                padding: "10px 28px",
                ...TYPE.bodySemibold,
                color: COLOR.darkGreen,
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    </DiagramCard>
  );
};

// ── Export ────────────────────────────────────────────────────────────────

export const SettlementDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={CYCLE_IN} durationInFrames={CYCLE_OUT - CYCLE_IN}>
        <SettlementCard />
        <Sfx sound={TEXT_IN} />
        {/* Step transitions */}
        <Sfx sound={TICK} delay={JOIN_AT} />
        <Sfx sound={TICK} delay={ORACLE_AT} />
        <Sfx sound={TICK} delay={SETTLE_AT} />
        {/* Phase 1: bettor cascade */}
        {BETTORS.map((_, i) => (
          <Sfx key={`join-${i}`} sound={PLOB} delay={sec(0.8 + i * 0.5)} />
        ))}
        {/* Phase 2: oracle nodes */}
        {ORACLE_STEPS.map((_, i) => (
          <Sfx key={`oracle-${i}`} sound={PLOB} delay={JOIN_AT + sec(0.5 + i * 1.2)} />
        ))}
        <Sfx
          sound={REVEAL}
          delay={JOIN_AT + sec(0.5 + ORACLE_STEPS.length * 1.2 + 0.6)}
        />
        {/* Phase 3: payouts */}
        <Sfx sound={COUNT} delay={ORACLE_AT + sec(1.2)} />
        {PAYOUTS.map((_, i) => (
          <Sfx key={`pay-${i}`} sound={PLOB} delay={ORACLE_AT + sec(1.2 + i * 0.4)} />
        ))}
        {/* Green pills */}
        <Sfx sound={PLOB} delay={sec(0.5)} />
        <Sfx sound={PLOB} delay={sec(0.7)} />
        <Sfx sound={PLOB} delay={sec(0.9)} />
      </Sequence>
    </AbsoluteFill>
  );
};
