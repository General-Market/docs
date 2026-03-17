interface CalloutProps {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}

const config = {
  info: {
    border: "border border-border-light bg-surface/50 border-l-[3px] border-l-black",
    label: "Note",
  },
  warning: {
    border: "border border-color-warning/30 bg-surface-warning border-l-[3px] border-l-color-warning",
    label: "Warning",
  },
  tip: {
    border: "border border-color-up/30 bg-surface-up border-l-[3px] border-l-color-up",
    label: "Tip",
  },
};

export function Callout({ type = "info", children }: CalloutProps) {
  const { border, label } = config[type];
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
