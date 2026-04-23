import { describe, expect, it } from "vitest";
import type { Clip } from "../project/schema";
import {
  duplicateClip,
  extractRange,
  lift,
  liftRange,
  rippleDelete,
  rippleTrim,
  splitAtFrame,
} from "./ripple";

function clip(id: string, at: number, inF: number, outF: number): Clip {
  return {
    id,
    assetId: "a1",
    in: inF,
    out: outF,
    at,
    linkedTo: [],
    syncOffsetFrames: 0,
    offsetSamples: 0,
    volumeDb: 0,
    phaseInvert: false,
    gainEnvelope: [],
  };
}

// Three back-to-back clips, each 60 frames long, on one track.
// A: at 0, src 0..60   → timeline 0..60
// B: at 60, src 0..60  → timeline 60..120
// C: at 120, src 0..60 → timeline 120..180
function three(): Clip[] {
  return [clip("A", 0, 0, 60), clip("B", 60, 0, 60), clip("C", 120, 0, 60)];
}

describe("rippleDelete", () => {
  it("collapses the gap when a middle clip is removed", () => {
    const out = rippleDelete(three(), "B");
    expect(out).toHaveLength(2);
    expect(out.find((c) => c.id === "A")!.at).toBe(0);
    expect(out.find((c) => c.id === "C")!.at).toBe(60);
  });

  it("leaves preceding clips alone when deleting the first", () => {
    const out = rippleDelete(three(), "A");
    expect(out).toHaveLength(2);
    // A.at was 0; anything with at > 0 shifts by -60.
    expect(out.find((c) => c.id === "B")!.at).toBe(0);
    expect(out.find((c) => c.id === "C")!.at).toBe(60);
  });
});

describe("lift", () => {
  it("removes the clip and leaves the gap", () => {
    const out = lift(three(), "B");
    expect(out.map((c) => c.id)).toEqual(["A", "C"]);
    expect(out.find((c) => c.id === "C")!.at).toBe(120);
  });
});

describe("splitAtFrame", () => {
  it("produces two clips when the frame falls inside a clip", () => {
    const out = splitAtFrame(three(), 30);
    expect(out).toHaveLength(4);
    const head = out.find((c) => c.at === 0)!;
    const tail = out.find((c) => c.at === 30)!;
    expect(head.in).toBe(0);
    expect(head.out).toBe(30);
    expect(tail.in).toBe(30);
    expect(tail.out).toBe(60);
    expect(head.id).not.toBe(tail.id);
  });

  it("does nothing when the frame is on a clip boundary", () => {
    const out = splitAtFrame(three(), 60);
    expect(out).toHaveLength(3);
  });
});

describe("extractRange", () => {
  it("cuts a partial overlap and ripples the remainder back", () => {
    // Range 30..90 slices A (0..60) at 30 and B (60..120) at 90.
    const out = extractRange(three(), 30, 90);
    // A shortens to 0..30. B becomes 90..120 material, rippled to 30..60.
    // C (120..180) ripples to 60..120.
    expect(out).toHaveLength(3);
    const sorted = [...out].sort((a, b) => a.at - b.at);
    expect(sorted[0].at).toBe(0);
    expect(sorted[0].out - sorted[0].in).toBe(30);
    expect(sorted[1].at).toBe(30);
    expect(sorted[1].out - sorted[1].in).toBe(30);
    expect(sorted[2].at).toBe(60);
    expect(sorted[2].out - sorted[2].in).toBe(60);
  });

  it("collapses the gap when the range lies in empty space", () => {
    const spaced = [clip("A", 0, 0, 60), clip("B", 120, 0, 60)];
    const out = extractRange(spaced, 60, 120);
    expect(out.find((c) => c.id === "A")!.at).toBe(0);
    expect(out.find((c) => c.id === "B")!.at).toBe(60);
  });
});

describe("liftRange", () => {
  it("cuts without shifting", () => {
    const out = liftRange(three(), 30, 90);
    const sorted = [...out].sort((a, b) => a.at - b.at);
    expect(sorted[0].at).toBe(0);
    expect(sorted[0].out - sorted[0].in).toBe(30);
    expect(sorted[1].at).toBe(90);
    expect(sorted[1].out - sorted[1].in).toBe(30);
    expect(sorted[2].at).toBe(120);
  });

  it("removes clips wholly inside the range", () => {
    const out = liftRange(three(), 55, 125);
    // A (0..60) → keep head 0..55. B (60..120) wholly inside → gone.
    // C (120..180) → keep tail 125..180.
    expect(out).toHaveLength(2);
    const sorted = [...out].sort((a, b) => a.at - b.at);
    expect(sorted[0].at).toBe(0);
    expect(sorted[0].out - sorted[0].in).toBe(55);
    expect(sorted[1].at).toBe(125);
  });
});

describe("rippleTrim", () => {
  it("shortens right edge and pulls followers back", () => {
    const out = rippleTrim(three(), "A", "right", 30);
    // A ends at 30 now. B and C shift by -30.
    expect(out.find((c) => c.id === "A")!.out).toBe(30);
    expect(out.find((c) => c.id === "B")!.at).toBe(30);
    expect(out.find((c) => c.id === "C")!.at).toBe(90);
  });

  it("extends right edge and pushes followers forward", () => {
    const out = rippleTrim(
      [clip("A", 0, 0, 30), clip("B", 30, 0, 30)],
      "A",
      "right",
      60,
    );
    expect(out.find((c) => c.id === "A")!.out).toBe(60);
    expect(out.find((c) => c.id === "B")!.at).toBe(60);
  });

  it("left-trims a clip, moving `in` and `at` in lockstep", () => {
    const out = rippleTrim(three(), "B", "left", 80);
    // B's `at` moves 60 → 80; in moves 0 → 20. B ends at 120 (unchanged).
    // Nothing shifts because end is unchanged.
    expect(out.find((c) => c.id === "B")!.at).toBe(80);
    expect(out.find((c) => c.id === "B")!.in).toBe(20);
    expect(out.find((c) => c.id === "C")!.at).toBe(120);
  });
});

describe("duplicateClip", () => {
  it("deep-copies with a new id and appends at the end by default", () => {
    const out = duplicateClip(three(), "B");
    expect(out).toHaveLength(4);
    const copy = out[3];
    expect(copy.id).not.toBe("B");
    expect(copy.at).toBe(180);
    // Sync group is stripped on duplicate.
    expect(copy.linkedTo).toEqual([]);
  });

  it("honours insertAt when provided", () => {
    const out = duplicateClip(three(), "A", 500);
    expect(out[3].at).toBe(500);
  });
});
