import { useState, useCallback } from "react";
import { useStore } from "@/project/store";
import type { Word } from "@/project/schema";
import { runDetectors } from "./detectors";

type Status = "idle" | "transcribing" | "done" | "error";

export function TranscribePanel() {
  const media = useStore((s) => s.project.media);
  const transcripts = useStore((s) => s.project.transcripts);
  const suggestions = useStore((s) => s.project.suggestions);
  const fps = useStore((s) => s.project.meta.fps);
  const upsertTranscript = useStore((s) => s.upsertTranscript);
  const setSuggestions = useStore((s) => s.setSuggestions);

  const [status, setStatus] = useState<Record<string, Status>>({});

  const transcribe = useCallback(
    async (assetId: string, path: string) => {
      setStatus((s) => ({ ...s, [assetId]: "transcribing" }));
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId, path }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { words: Word[] };
        const transcript = { assetId, words: body.words, sentences: [] };
        upsertTranscript(transcript);

        // Re-read current suggestions via store to avoid stepping on
        // concurrent transcription of another asset.
        const current = useStore.getState().project.suggestions;
        const others = current.filter((s) => s.assetId !== assetId);
        const fresh = runDetectors(transcript, assetId, fps);
        setSuggestions([...others, ...fresh]);

        setStatus((s) => ({ ...s, [assetId]: "done" }));
      } catch (err) {
        console.error("transcribe failed", err);
        setStatus((s) => ({ ...s, [assetId]: "error" }));
      }
    },
    [fps, setSuggestions, upsertTranscript],
  );

  const transcribeAll = useCallback(() => {
    for (const a of media) {
      if (a.kind === "video" || a.kind === "audio") {
        void transcribe(a.id, a.path);
      }
    }
  }, [media, transcribe]);

  const transcribable = media.filter(
    (a) => a.kind === "video" || a.kind === "audio",
  );

  return (
    <div style={{ padding: "var(--space-3)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-3)",
        }}
      >
        <span
          className="label"
          style={{ color: "var(--fg-dim)" }}
        >
          Parakeet V3
        </span>
        <button
          onClick={transcribeAll}
          disabled={transcribable.length === 0}
          style={{ fontSize: "var(--fs-11)" }}
        >
          Transcribe all
        </button>
      </div>

      {transcribable.length === 0 ? (
        <div className="empty-state" style={{ height: 80 }}>
          No audio or video to transcribe
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {transcribable.map((a) => {
            const s = status[a.id]
              ?? (transcripts.some((t) => t.assetId === a.id) ? "done" : "idle");
            const count = suggestions.filter((x) => x.assetId === a.id).length;
            return (
              <li
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-2)",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--divider)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      color: "var(--fg)",
                      fontSize: "var(--fs-12)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.path.split("/").pop()}
                  </div>
                  <div className="label">
                    {s === "transcribing"
                      ? "transcribing…"
                      : s === "done"
                        ? `done · ${count} suggestions`
                        : s === "error"
                          ? "error"
                          : "idle"}
                  </div>
                </div>
                <button
                  onClick={() => transcribe(a.id, a.path)}
                  disabled={s === "transcribing"}
                  style={{ fontSize: "var(--fs-11)" }}
                >
                  {s === "done" ? "Re-transcribe" : "Transcribe"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
