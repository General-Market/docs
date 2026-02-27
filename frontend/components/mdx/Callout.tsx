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
    border: "border border-yellow-200 bg-yellow-50/50 border-l-[3px] border-l-yellow-500",
    label: "Warning",
  },
  tip: {
    border: "border border-green-200 bg-green-50/50 border-l-[3px] border-l-green-600",
    label: "Tip",
  },
};

export function Callout({ type = "info", children }: CalloutProps) {
  const { border, label } = config[type];
  return (
    <div
      className={`${border} px-5 py-4 my-8`}
    >
      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-text-muted mb-2">
        {label}
      </div>
      <div className="text-[15px] text-text-secondary leading-relaxed">
        {children}
      </div>
    </div>
  );
}
