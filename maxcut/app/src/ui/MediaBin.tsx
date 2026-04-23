import { useRef } from "react";
import { useStore, genId } from "@/project/store";
import type { Asset } from "@/project/schema";

export function MediaBin() {
  const media = useStore((s) => s.project.media);
  const addAsset = useStore((s) => s.addAsset);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const path = (f as File & { path?: string }).path ?? f.name;
      const kind: Asset["kind"] = f.type.startsWith("video")
        ? "video"
        : f.type.startsWith("audio")
        ? "audio"
        : f.type.startsWith("image")
        ? "image"
        : "video";

      try {
        const res = await fetch("/api/assets/probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        const probe = res.ok ? await res.json() : {};
        addAsset({
          id: genId(),
          path,
          kind,
          duration: probe.duration ?? 0,
          sourceFps: probe.fps ?? 60,
          probe,
        });
      } catch {
        addAsset({
          id: genId(),
          path,
          kind,
          duration: 0,
          sourceFps: 60,
          probe: {},
        });
      }
    }
  }

  return (
    <div style={{ padding: "var(--space-2)" }}>
      <button
        style={{ width: "100%" }}
        onClick={() => inputRef.current?.click()}
      >
        Import media…
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {media.length === 0 ? (
        <div className="empty-state" style={{ height: 120, marginTop: 12 }}>
          No media imported
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "var(--space-2) 0" }}>
          {media.map((a) => (
            <li
              key={a.id}
              style={{
                padding: "var(--space-1) var(--space-2)",
                borderBottom: "1px solid var(--divider)",
                cursor: "grab",
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-maxcut-asset", a.id);
              }}
            >
              <div style={{ color: "var(--fg)" }}>{a.path.split("/").pop()}</div>
              <div className="label">{a.kind} · {Math.round(a.duration)} fr</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
