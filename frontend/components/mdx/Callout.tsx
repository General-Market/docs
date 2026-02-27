interface CalloutProps {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}

const styles = {
  info: "border-l-4 border-black bg-surface/50",
  warning: "border-l-4 border-yellow-500 bg-yellow-50",
  tip: "border-l-4 border-green-600 bg-green-50",
};

export function Callout({ type = "info", children }: CalloutProps) {
  return (
    <div
      className={`${styles[type]} px-5 py-4 my-6 text-[15px] text-text-secondary leading-relaxed`}
    >
      {children}
    </div>
  );
}
