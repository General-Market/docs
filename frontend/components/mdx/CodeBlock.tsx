interface CodeBlockProps {
  children: React.ReactNode;
  title?: string;
}

export function CodeBlock({ children, title }: CodeBlockProps) {
  return (
    <div className="my-6 border border-border-light overflow-hidden">
      {title && (
        <div className="bg-black text-white text-[12px] font-mono px-4 py-2 border-b border-border-light">
          {title}
        </div>
      )}
      <div className="bg-surface/30 overflow-x-auto">{children}</div>
    </div>
  );
}
