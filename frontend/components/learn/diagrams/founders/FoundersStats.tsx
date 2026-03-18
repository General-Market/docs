"use client";

import { TIER_SUMMARY } from "./data";

export function FoundersStats() {
  return (
    <div className="my-8 grid grid-cols-3 gap-3">
      {TIER_SUMMARY.map((t) => (
        <div
          key={t.tier}
          className="border border-border-light bg-white p-4 text-center"
        >
          <div className="text-label text-text-muted uppercase tracking-[0.08em] font-medium mb-2">
            {t.tier}
          </div>
          <div className="text-display font-black text-black leading-none">
            {t.avgAge}
          </div>
          <div className="text-label text-text-muted mt-1">avg age</div>
          <div className="mt-3 flex justify-center gap-4 text-label text-text-secondary">
            <span>
              <span className="font-semibold text-black">{t.ageChange}</span>{" "}
              since 2021
            </span>
            <span>
              <span className="font-semibold text-black">{t.malePct}%</span>{" "}
              male
            </span>
          </div>
          <div className="text-label text-text-muted mt-1">
            {t.founders.toLocaleString()} founders
          </div>
        </div>
      ))}
    </div>
  );
}
