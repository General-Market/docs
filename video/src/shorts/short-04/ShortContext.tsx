import React, { createContext, useContext } from "react";

interface ShortContextValue {
  assetDir: string;
}

const ShortContext = createContext<ShortContextValue | null>(null);

export const ShortProvider: React.FC<
  ShortContextValue & { children: React.ReactNode }
> = ({ assetDir, children }) => (
  <ShortContext.Provider value={{ assetDir }}>{children}</ShortContext.Provider>
);

export const useShortContext = (): ShortContextValue => {
  const ctx = useContext(ShortContext);
  if (!ctx) throw new Error("useShortContext must be inside ShortProvider");
  return ctx;
};
