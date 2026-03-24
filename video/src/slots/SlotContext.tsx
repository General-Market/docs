import React, { createContext, useContext } from "react";

interface SlotContextValue {
  assetDir: string;
}

const SlotContext = createContext<SlotContextValue | null>(null);

export const SlotProvider: React.FC<
  SlotContextValue & { children: React.ReactNode }
> = ({ assetDir, children }) => (
  <SlotContext.Provider value={{ assetDir }}>{children}</SlotContext.Provider>
);

export const useSlotContext = (): SlotContextValue => {
  const ctx = useContext(SlotContext);
  if (!ctx) throw new Error("useSlotContext must be inside SlotProvider");
  return ctx;
};
