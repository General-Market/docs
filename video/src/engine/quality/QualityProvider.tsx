import React, { createContext, useContext, useMemo } from "react";
import type { QualityMode, QualityConfig } from "../types/quality";
import { QUALITY_CONFIGS } from "../types/quality";

interface QualityContextValue {
  mode: QualityMode;
  config: QualityConfig;
}

const QualityContext = createContext<QualityContextValue>({
  mode: "final",
  config: QUALITY_CONFIGS.final,
});

export const QualityProvider: React.FC<{
  mode?: QualityMode;
  children: React.ReactNode;
}> = ({ mode = "final", children }) => {
  const value = useMemo(
    () => ({ mode, config: QUALITY_CONFIGS[mode] }),
    [mode],
  );
  return (
    <QualityContext.Provider value={value}>
      {children}
    </QualityContext.Provider>
  );
};

/** Hook to read current quality mode and config */
export function useQuality(): QualityContextValue {
  return useContext(QualityContext);
}
