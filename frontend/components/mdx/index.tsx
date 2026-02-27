import type { MDXComponents } from "mdx/types";
import { Link } from "@/i18n/routing";
import { Callout } from "./Callout";
import { ComparisonTable } from "./ComparisonTable";
import { CodeBlock } from "./CodeBlock";

export const mdxComponents: MDXComponents = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-[32px] md:text-[40px] font-black tracking-[-0.02em] text-black leading-[1.1] mb-4">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="border-t-[3px] border-black pt-8 mt-16 mb-6 text-[24px] md:text-[28px] font-black tracking-[-0.02em] text-black leading-[1.1]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[18px] font-bold tracking-[-0.01em] text-black mt-8 mb-3">
      {children}
    </h3>
  ),

  // Text
  p: ({ children }) => (
    <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-black">{children}</strong>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc ml-5 space-y-2 text-[15px] text-text-secondary leading-relaxed mb-4 marker:text-text-muted">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ml-5 space-y-2 text-[15px] text-text-secondary leading-relaxed mb-4 marker:text-text-muted marker:font-mono marker:font-bold">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1.5">{children}</li>,

  // Links
  a: ({ href, children, ...props }) => {
    if (href && href.startsWith("/")) {
      return (
        <Link
          href={href}
          className="text-black font-semibold border-b border-black/30 hover:border-black transition-colors"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-black font-semibold border-b border-black/30 hover:border-black transition-colors"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Table
  table: ({ children }) => (
    <div className="border border-border-light overflow-x-auto my-8">
      <table className="w-full text-[14px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => (
    <th className="text-left bg-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-5 py-3">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-5 py-3.5 text-[14px] text-text-secondary border-t border-border-light">
      {children}
    </td>
  ),

  // Code
  code: ({ children }) => (
    <code className="bg-zinc-100 text-[13px] font-mono px-1.5 py-0.5 text-zinc-800 rounded-sm border border-zinc-200">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-zinc-950 text-zinc-100 border border-zinc-800 overflow-x-auto p-5 my-8 text-[13px] font-mono leading-relaxed rounded-sm">
      {children}
    </pre>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-black bg-surface/50 px-6 py-5 my-8 text-[16px] text-text-secondary leading-relaxed italic">
      {children}
    </blockquote>
  ),

  // Custom components
  Callout,
  ComparisonTable,
  CodeBlock,
};
