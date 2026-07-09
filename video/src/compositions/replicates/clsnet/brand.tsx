import React, { createContext, useContext } from "react";
import { COPY } from "./data";
import { SERIF } from "./fonts";

// Brand layer: the replica (CLS) is the default; CrxNetting overrides via
// provider with values from crx-data.ts. Same scenes, same choreography.
export type BrandCopy = typeof COPY;

export type Brand = {
  copy: BrandCopy;
  serif: string;
  sans: string;
  boxLabel: string; // label under the logo box
  logoArt: string | null; // traced logo asset name (null = text logo)
  logoText?: string; // text logo when logoArt is null
};

export const CLS_BRAND: Brand = {
  copy: COPY,
  serif: SERIF,
  sans: "Helvetica Neue, Helvetica, Arial, sans-serif",
  boxLabel: "CLSNet",
  logoArt: "clsLogo",
};

const BrandCtx = createContext<Brand>(CLS_BRAND);

export const BrandProvider: React.FC<{ brand: Brand; children: React.ReactNode }> = ({
  brand,
  children,
}) => <BrandCtx.Provider value={brand}>{children}</BrandCtx.Provider>;

export const useBrand = () => useContext(BrandCtx);
export const useCopy = () => useContext(BrandCtx).copy;
