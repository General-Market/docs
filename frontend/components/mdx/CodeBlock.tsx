interface CodeBlockProps {
  children: React.ReactNode;
  title?: string;
}

export function CodeBlock({ children, title }: CodeBlockProps) {
  return (
    <div className="my-8 border border-zinc-800 rounded-sm overflow-hidden">
      {title && (
        <div className="bg-black text-white/70 text-[11px] font-semibold tracking-[0.1em] uppercase font-mono px-5 py-2.5 border-b border-zinc-800">
          {title}
        </div>
      )}
      <div className="bg-zinc-950 text-zinc-100 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
