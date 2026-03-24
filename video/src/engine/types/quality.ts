// ---------------------------------------------------------------------------
// Quality modes — draft/preview/final for Studio preview vs render
// ---------------------------------------------------------------------------

export type QualityMode = "draft" | "preview" | "final";

export interface QualityConfig {
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  bloomStrength: number;

  rain: boolean;
  lightning: boolean;
  fog: boolean;
  npcs: boolean;
  maxNpcs: number;
  filmGrain: boolean;
  desaturation: boolean;
  oceanPhysics: boolean;
  antialias: boolean;
  toneMappingExposure: number;
}

export const QUALITY_CONFIGS: Record<QualityMode, QualityConfig> = {
  draft: {
    shadows: false,
    shadowMapSize: 0,
    bloom: false,
    bloomStrength: 0,

    rain: false,
    lightning: false,
    fog: false,
    npcs: false,
    maxNpcs: 0,
    filmGrain: false,
    desaturation: false,
    oceanPhysics: false,
    antialias: false,
    toneMappingExposure: 1.3,
  },
  preview: {
    shadows: true,
    shadowMapSize: 256,
    bloom: true,
    bloomStrength: 0.25,

    rain: true,
    lightning: true,
    fog: true,
    npcs: true,
    maxNpcs: 3,
    filmGrain: false,
    desaturation: true,
    oceanPhysics: false,
    antialias: true,
    toneMappingExposure: 1.3,
  },
  final: {
    shadows: true,
    shadowMapSize: 512,
    bloom: true,
    bloomStrength: 0.35,

    rain: true,
    lightning: true,
    fog: true,
    npcs: true,
    maxNpcs: 999,
    filmGrain: true,
    desaturation: true,
    oceanPhysics: true,
    antialias: true,
    toneMappingExposure: 1.3,
  },
};
