import { useMemo } from "react";
import { useStore } from "@/project/store";
import { framesToTimecode } from "@/editor/timecode";
import type { CutSuggestion } from "@/project/schema";
import { useAiActions } from "./useAiActions";

function kindColor(kind: CutSuggestion["kind"]): string {
  // All detectors wear the same amber — "robot proposed this" in one glance.
  void kind;
  return "var(--accent-warm)";
}

export function SuggestionList() {
  const suggestions = useStore((s) => s.project.suggestions);
  const media = useStore((s) => s.project.media);
  const fps = useStore((s) => s.project.meta.fps);
  const setPlayhead = useStore((s) => s.setPlayhead);
  const {
    acceptSuggestion,
    rejectSuggestion,
    acceptAllSilencesOver,
    acceptAllFillers,
    rejectAll,
  } = useAiActions();

  const assetName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of media) map.set(a.id, a.path.split("/").pop() ?? a.path);
    return map;
  }, [media]);

  const pending = suggestions.filter((s) => s.status === "pending");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-1)",
          paddingBottom: "var(--space-2)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        <button
          onClick={() => void acceptAllSilencesOver(1000)}
          style={{ fontSize: "var(--fs-11)" }}
        >
          Accept silences &gt; 1s
        </button>
        <button
          onClick={() => void acceptAllFillers()}
          style={{ fontSize: "var(--fs-11)" }}
        >
          Accept fillers
        </button>
        <button
          onClick={rejectAll}
          style={{ fontSize: "var(--fs-11)" }}
        >
          Reject all
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="empty-state" style={{ height: 80 }}>
          No pending suggestions
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {pending.map((s) => {
            const confPct = Math.round(Math.max(0, Math.min(1, s.confidence)) * 100);
            const name = assetName.get(s.assetId) ?? s.assetId;
            return (
              <li
                key={s.id}
                style={{
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--divider)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span
                    style={{
                      fontSize: "var(--fs-10)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "2px 6px",
                      border: `1px solid ${kindColor(s.kind)}`,
                      color: kindColor(s.kind),
                      borderRadius: 2,
                    }}
                  >
                    {s.kind}
                  </span>
                  <span
                    className="label"
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
                  <span className="mono" style={{ fontSize: "var(--fs-11)", color: "var(--fg-dim)" }}>
                    {framesToTimecode(s.start, fps)}—{framesToTimecode(s.end, fps)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "var(--fs-12)",
                    color: "var(--fg)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.text}
                </div>
                <div
                  title={`confidence ${confPct}%`}
                  style={{
                    height: 2,
                    background: "var(--divider)",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${confPct}%`,
                      background: "var(--accent-warm)",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: "var(--space-1)" }}>
                  <button
                    onClick={() => setPlayhead(s.start)}
                    style={{ fontSize: "var(--fs-11)" }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => void acceptSuggestion(s.id)}
                    style={{ fontSize: "var(--fs-11)" }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => rejectSuggestion(s.id)}
                    style={{ fontSize: "var(--fs-11)" }}
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
