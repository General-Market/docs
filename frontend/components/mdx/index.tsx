import type { MDXComponents } from "mdx/types";
import { Link } from "@/i18n/routing";
import { Callout } from "./Callout";
import { ComparisonTable } from "./ComparisonTable";
import { CodeBlock } from "./CodeBlock";

export const mdxComponents: MDXComponents = {
  // Headings — match frontend/app/[locale]/learn/what-are-itps/page.tsx exactly
  h1: ({ children }) => (
    <h1 className="text-[32px] md:text-[40px] font-black tracking-[-0.02em] text-black leading-[1.1] mb-4">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[22px] font-black tracking-[-0.01em] mt-12 mb-4 text-black">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[17px] font-bold mt-6 mb-2 text-black">{children}</h3>
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
    <ul className="space-y-3 text-[15px] text-text-secondary leading-relaxed mb-4">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ml-6 space-y-3 text-[15px] text-text-secondary leading-relaxed mb-4">
      {children}
    </ol>
  ),

  // Links — use next-intl Link for internal, regular <a> for external
  a: ({ href, children, ...props }) => {
    if (href && href.startsWith("/")) {
      return (
        <Link
          href={href}
          className="text-black font-bold underline hover:no-underline"
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
        className="text-black font-bold underline hover:no-underline"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Table
  table: ({ children }) => (
    <div className="border border-border-light overflow-x-auto my-6">
      <table className="w-full text-[14px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => (
    <th className="text-left px-4 py-3 font-bold text-black bg-surface">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-text-secondary border-t border-border-light">
      {children}
    </td>
  ),

  // Code
  code: ({ children }) => (
    <code className="bg-surface/50 text-[13px] font-mono px-1.5 py-0.5 text-black">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-surface/30 border border-border-light overflow-x-auto p-4 my-6 text-[13px] font-mono leading-relaxed">
      {children}
    </pre>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-black bg-surface/50 px-5 py-4 my-6 text-[15px] text-text-secondary leading-relaxed">
      {children}
    </blockquote>
  ),

  // Custom components
  Callout,
  ComparisonTable,
  CodeBlock,
};
