import React from "react";
import { interpolate } from "remotion";
import { clamp } from "./AnomaComposition";
import { BORDER, BORDER_STRONG, CARD, Card, Check, INK, SEC, SUCCESS, SUCCESS_SOFT, TER, WELL, fadeIn, settle, tnum } from "./CrxCardKit";

// ─── Scene 10 (f1204-1356): compliance checklist under "Compliance by design" ───
// Crossfades over the RFQ card; checks tick in on the slow pulse, one every ~22f
// (f1226/1248/1270/1291); the All-clear pill is the conclusion — it lands on the
// f1313 snare and HOLDS ~22 frames before the card fades, instead of arriving
// into its own death.
const COMPLY_ROWS = [
  { at: 1226, k: "KYB", v: "Verified" },
  { at: 1248, k: "Sanctions screening", v: "Clear · 0 hits" },
  { at: 1270, k: "Travel rule", v: "Enabled" },
  { at: 1291, k: "Audit export", v: "CSV · PDF ready" },
];
const ALL_CLEAR_AT = 1313;

export const CrxScene10Comply: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 1204 || frame >= 1357) return null;
  const opacity =
    interpolate(frame, [1204, 1226], [0, 1], clamp) *
    interpolate(frame, [1335, 1357], [1, 0], clamp);
  return (
    <Card x={CARD.left} y={CARD.top} w={CARD.w} h={CARD.h} opacity={opacity}>
      <div style={{ position: "absolute", inset: 0, padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Compliance</span>
          {frame >= ALL_CLEAR_AT && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 400,
                color: SUCCESS,
                backgroundColor: SUCCESS_SOFT,
                borderRadius: 980,
                padding: "3px 10px",
                ...settle(frame, ALL_CLEAR_AT, 10, 0.74),
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SUCCESS }} />
              All clear
            </div>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 60,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        {/* the checks live in a sunken panel, grouped like the app's list */}
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 80,
            width: 650,
            height: 320,
            backgroundColor: WELL,
            borderRadius: 14,
          }}
        />

        {COMPLY_ROWS.map(({ at, k, v }, i) => {
          const on = frame >= at;
          const pop = on ? 1 + 0.18 * Math.pow(0.68, frame - at) : 1;
          const rowOp = fadeIn(frame, at - 4, 4);
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: 48,
                top: 92 + i * 74,
                width: 614,
                height: 74,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: i === 0 ? undefined : `1px solid ${BORDER}`,
                opacity: rowOp,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* the app's completed check: soft green well, green
                    glyph (bg-success/15 text-success) — never a solid
                    green disc */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: on ? SUCCESS_SOFT : BORDER_STRONG,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${pop.toFixed(3)})`,
                  }}
                >
                  {on && <Check size={14} stroke={16} color={SUCCESS} />}
                </div>
                <span style={{ fontSize: 15.5, fontWeight: 700 }}>{k}</span>
              </div>
              <span style={{ fontSize: 13.5, color: on ? SEC : TER, ...tnum }}>{v}</span>
            </div>
          );
        })}

        {/* the conclusion, filling the lower band: a full-width success strip
            that lands with the All-clear pill on the f1313 snare */}
        {frame >= ALL_CLEAR_AT && (
          <div
            style={{
              position: "absolute",
              left: 30,
              top: 416,
              width: 650,
              height: 34,
              display: "flex",
              alignItems: "center",
              gap: 9,
              color: SEC,
              fontSize: 13,
              ...settle(frame, ALL_CLEAR_AT, 8, 0.76),
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: SUCCESS_SOFT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Check size={10} stroke={17} color={SUCCESS} />
            </div>
            <span>
              Sanctions-screened, audit-logged,{" "}
              <span style={{ color: INK, fontWeight: 700 }}>cleared to trade</span>.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};
