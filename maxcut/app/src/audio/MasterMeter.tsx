import { useStore } from "../project/store";
import { Meter } from "../waveform/Meter";

/**
 * Top-right master dBFS peak strip. Reads the ephemeral `masterPeakDb`.
 * Updates are pushed by the preview audio tap via `setMasterPeakDb`.
 */
export function MasterMeter() {
  const peakDb = useStore((s) => s.masterPeakDb);
  return (
    <div
      style={{
        position: "absolute",
        top: 6,
        right: 8,
        width: 120,
        height: 10,
        pointerEvents: "none",
      }}
    >
      <Meter peakDb={peakDb} />
    </div>
  );
}
