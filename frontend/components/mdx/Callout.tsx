"use client";

import { useTranslations } from "next-intl";

interface CalloutProps {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}

const borderStyles = {
  info: "border border-border-light bg-surface/50 border-l-[3px] border-l-black",
  warning: "border border-yellow-200 bg-yellow-50/50 border-l-[3px] border-l-yellow-500",
  tip: "border border-green-200 bg-green-50/50 border-l-[3px] border-l-green-600",
};

const labelKeys = {
  info: "callout_note" as const,
  warning: "callout_warning" as const,
  tip: "callout_tip" as const,
};

export function Callout({ type = "info", children }: CalloutProps) {
  const t = useTranslations("common");
  const border = borderStyles[type];
  const label = t(labelKeys[type]);
  return (
    <div
      className={`${border} px-5 py-4 my-8`}
    >
      <div className="text-label font-semibold tracking-[0.08em] uppercase text-text-muted mb-2">
        {label}
      </div>
      <div className="text-body text-text-secondary leading-relaxed">
        {children}
      </div>
    </div>
  );
}
