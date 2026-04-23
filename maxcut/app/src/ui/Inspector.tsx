import { useStore } from "@/project/store";
import { SuggestionList } from "@/ai/SuggestionList";
import { TranscriptView } from "@/ai/TranscriptView";
import { useState } from "react";

type Tab = "inspector" | "ai" | "transcript";

export function Inspector() {
  const [tab, setTab] = useState<Tab>("inspector");
  const selection = useStore((s) => s.selection);
  const project = useStore((s) => s.project);

  const selectedClip =
    selection.kind === "clips" && selection.ids.length === 1
      ? project.tracks.flatMap((t) => t.clips).find((c) => c.id === selection.ids[0])
      : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--divider)" }}>
        {(["inspector", "ai", "transcript"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              border: "none",
              borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`,
              borderRadius: 0,
              padding: "var(--space-2) 0",
              background: "transparent",
              fontSize: "var(--fs-10)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: tab === t ? "var(--fg)" : "var(--fg-dim)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "var(--space-3)" }}>
        {tab === "inspector" && (
          selectedClip ? (
            <div className="mono" style={{ fontSize: "var(--fs-11)" }}>
              <div><span className="label">ID</span> {selectedClip.id}</div>
              <div><span className="label">IN</span> {selectedClip.in}</div>
              <div><span className="label">OUT</span> {selectedClip.out}</div>
              <div><span className="label">AT</span> {selectedClip.at}</div>
              <div><span className="label">GAIN</span> {selectedClip.volumeDb.toFixed(1)} dB</div>
            </div>
          ) : (
            <div className="empty-state">Select a clip</div>
          )
        )}
        {tab === "ai" && <SuggestionList />}
        {tab === "transcript" && <TranscriptView />}
      </div>
    </div>
  );
}
