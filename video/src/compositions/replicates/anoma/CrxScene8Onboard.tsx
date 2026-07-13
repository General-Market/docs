import React from "react";
import { interpolate } from "remotion";
import { DIATYPE } from "./diatype";
import { clamp } from "./AnomaComposition";
import { BORDER, BORDER_STRONG, CARD, Card, Check, FOCUS_RING, INK, SEC, SUCCESS, SUCCESS_SOFT, Spinner, TEAL, TER, WELL, fadeIn, settle, tnum } from "./CrxCardKit";

// ─── Scene 8 (f743-940): compliance onboarding under "Onboard in days" ───
// Re-laid on the SPARSE breakdown melody (owner: tick the card ON the tune, not
// an arbitrary clock). The five faces step on a ~28f pulse — 743/771/799/827/855
// — landing on the sparse breakdown notes; each visible change ticks with the
// music. The success dot pops at f857, floods the card on the f864 melodic hit
// (the big visual pop) and resolves to Verified by ~f872. The Verified face holds,
// then fades f894-940 so it never runs into the S9 cut at f962.
type ObRow = { k: string; v: string; state?: "pending" | "done" | "run" };

// Five faces on the ~28f sparse pulse (743/771/799/827/855). The two entity
// fills (legal entity + LEI) resolve together on the f771 tick so the whole
// checklist fits the breakdown before the f864 success flood; no content is
// lost, only the two incremental Entity ticks merge into one.
const OB_STATES: { at: number; step: number; rows: ObRow[] }[] = [
  {
    at: 743,
    step: 0,
    rows: [
      { k: "Legal entity", v: "—", state: "pending" },
      { k: "LEI", v: "—", state: "pending" },
      { k: "Jurisdiction", v: "—", state: "pending" },
    ],
  },
  {
    at: 771,
    step: 0,
    rows: [
      { k: "Legal entity", v: "Acme Treasury Ltd", state: "done" },
      { k: "LEI", v: "5493 00K2 T4YQ 12BC 7A91", state: "done" },
      { k: "Jurisdiction", v: "—", state: "pending" },
    ],
  },
  {
    at: 799,
    step: 1,
    rows: [
      { k: "Legal entity", v: "Acme Treasury Ltd", state: "done" },
      { k: "LEI", v: "5493 00K2 T4YQ 12BC 7A91", state: "done" },
      { k: "Jurisdiction", v: "United Kingdom", state: "done" },
    ],
  },
  {
    at: 827,
    step: 1,
    rows: [
      { k: "KYB documents", v: "Received", state: "done" },
      { k: "Sanctions screening", v: "Running…", state: "run" },
      { k: "Beneficial owners", v: "Verifying…", state: "run" },
    ],
  },
  {
    at: 855,
    step: 2,
    rows: [
      { k: "KYB documents", v: "Verified", state: "done" },
      { k: "Sanctions screening", v: "Clear", state: "done" },
      { k: "Custody wallet", v: "0x12B7…0D1F whitelisted", state: "done" },
    ],
  },
];

const OB_STEPS = ["Entity", "Verification", "Wallet"];

const ObFace: React.FC<{
  frame: number;
  at: number;
  step: number;
  rows: ObRow[];
  prevRows: ObRow[] | null;
}> = ({ frame, at, step, rows, prevRows }) => (
  <div style={{ position: "absolute", inset: 0, padding: "26px 30px", backgroundColor: "#fff" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Compliance</span>
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

    {/* stepper — the app's StepFlow rail (components/desk/StepFlow.tsx): a flex
        row of numbered nodes with flex-1 connectors on each side, so the bars
        always meet the node edges flush (no absolute gap math — the earlier
        version left a gap before the next circle). A segment reads teal once its
        left node is complete. Digits center optically in the disc via
        inline-flex centering plus line-height:1 (raw metric leading was pushing
        them off-center). */}
    <div
      style={{
        position: "absolute",
        left: 30,
        top: 82,
        width: 650,
        display: "flex",
        alignItems: "flex-start",
      }}
    >
      {OB_STEPS.map((s, i) => {
        const done = step > i;
        const active = step === i;
        const first = i === 0;
        const last = i === OB_STEPS.length - 1;
        return (
          <div
            key={s}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
              <div
                style={{
                  height: 2,
                  flex: 1,
                  backgroundColor: first ? "transparent" : step >= i ? TEAL : BORDER_STRONG,
                }}
              />
              <div
                style={{
                  width: 24,
                  height: 24,
                  margin: "0 4px",
                  borderRadius: 12,
                  flexShrink: 0,
                  backgroundColor: done || active ? TEAL : "#fff",
                  border: done || active ? "none" : `2px solid ${BORDER_STRONG}`,
                  boxShadow: active ? FOCUS_RING : undefined,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done ? (
                  <Check size={13} stroke={16} />
                ) : (
                  <span
                    style={{
                      // Optical centering: a numeral carries no descender, so the
                      // line box's descent space (lineHeight:1) leaves the ink
                      // sitting ~1px high in the disc. A 1px downward nudge lands
                      // the glyph dead-center (measured 7px above / 9px below → 8/8).
                      position: "relative",
                      top: 1,
                      fontSize: 11.5,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: active ? "#fff" : TER,
                      fontFamily: DIATYPE,
                    }}
                  >
                    {i + 1}
                  </span>
                )}
              </div>
              <div
                style={{
                  height: 2,
                  flex: 1,
                  backgroundColor: last ? "transparent" : step > i ? TEAL : BORDER_STRONG,
                }}
              />
            </div>
            <div
              style={{
                marginTop: 7,
                fontSize: 12,
                fontWeight: active || done ? 700 : 400,
                color: active || done ? INK : TER,
              }}
            >
              {s}
            </div>
          </div>
        );
      })}
    </div>

    {/* the checklist lives in a sunken panel — the app groups rows inside a soft
        inset, not on bare hairlines floating in white space */}
    <div
      style={{
        position: "absolute",
        left: 30,
        top: 150,
        width: 650,
        height: 232,
        backgroundColor: WELL,
        borderRadius: 14,
      }}
    />

    {/* rows — a row whose key is new to this face drops in staggered */}
    {rows.map((r, i) => {
      const fresh = !prevRows || prevRows[i]?.k !== r.k;
      const drop = fresh ? settle(frame, at + 1 + i * 2, 9, 0.76) : {};
      const statusWord = ["Received", "Verified", "Clear", "Enabled"].includes(r.v);
      return (
        <div
          key={r.k}
          style={{
            position: "absolute",
            left: 48,
            top: 167 + i * 66,
            width: 614,
            height: 66,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: i === 0 ? undefined : `1px solid ${BORDER}`,
            ...drop,
          }}
        >
          <span style={{ fontSize: 14.5, fontWeight: 400, color: SEC }}>{r.k}</span>
          {r.state === "pending" ? (
            <span style={{ fontSize: 14, color: TER }}>—</span>
          ) : r.state === "run" ? (
            // live work sits in a pill with the spinner, the way the app shows
            // an in-flight check
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                backgroundColor: "#fff",
                border: `1px solid ${BORDER}`,
                borderRadius: 980,
                padding: "5px 12px 5px 10px",
              }}
            >
              <Spinner frame={frame} size={14} />
              <span style={{ fontSize: 13, color: SEC }}>{r.v}</span>
            </div>
          ) : statusWord ? (
            // a resolved status word is a success chip, not plain text
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                backgroundColor: SUCCESS_SOFT,
                borderRadius: 980,
                padding: "5px 12px 5px 9px",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: SUCCESS,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={9} stroke={19} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: SUCCESS }}>{r.v}</span>
            </div>
          ) : (
            // a resolved data value keeps its check and reads in ink
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: SUCCESS,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Check size={9} stroke={19} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 400, color: INK, ...tnum }}>{r.v}</span>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export const CrxScene8Onboard: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 743 || frame >= 940) return null;
  // Verified resolves ~f872 and HOLDS, then fades f920-940 so the card is gone by
  // f940 — on the SAME window as the S8 headline, so both vanish together, with a
  // breath of wave before the S9 dealers card cuts in at f962.
  const cardOpacity = interpolate(frame, [920, 940], [1, 0], clamp);
  if (cardOpacity <= 0) return null;
  // Success dot: pops small at f857 over the completed checklist, holds, then
  // FLOODS the card on the f864 melodic hit (the big visual pop); the Verified
  // face resolves out of it by ~f872.
  const dotD = interpolate(
    frame,
    [857, 860, 862, 864, 867, 870],
    [12, 44, 42, 42, 500, 950],
    clamp,
  );
  const successOp = interpolate(frame, [864, 872], [0, 1], clamp);
  return (
    <Card x={CARD.left} y={CARD.top} w={CARD.w} h={CARD.h} opacity={cardOpacity}>
      {OB_STATES.map(({ at, step, rows }, i) => {
        const op = fadeIn(frame, at, 3);
        if (op <= 0) return null;
        const next = OB_STATES[i + 1];
        if (next && frame >= next.at + 3) return null;
        return (
          <div key={at} style={{ position: "absolute", inset: 0, opacity: op }}>
            <ObFace
              frame={frame}
              at={at}
              step={step}
              rows={rows}
              prevRows={i > 0 ? OB_STATES[i - 1].rows : null}
            />
          </div>
        );
      })}
      {frame >= 857 && successOp < 1 && (
        <div
          style={{
            position: "absolute",
            left: 349 - dotD / 2,
            top: 257 - dotD / 2,
            width: dotD,
            height: dotD,
            borderRadius: "50%",
            backgroundColor: TEAL,
          }}
        />
      )}
      {successOp > 0 && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "#fff", opacity: successOp }}>
          <div
            style={{
              position: "absolute",
              left: 349 - 37,
              top: 168,
              width: 74,
              height: 74,
              borderRadius: 37,
              backgroundColor: TEAL,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={40} stroke={13} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 262,
              width: "100%",
              textAlign: "center",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -0.5,
              color: INK,
              fontFamily: DIATYPE,
            }}
          >
            Verified
          </div>
          <div
            style={{
              position: "absolute",
              top: 300,
              width: "100%",
              textAlign: "center",
              fontSize: 14.5,
              color: SEC,
              fontFamily: DIATYPE,
            }}
          >
            Ready to trade on CRX
          </div>
        </div>
      )}
    </Card>
  );
};
