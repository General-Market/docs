import type { MDXComponents } from 'mdx/types'
import { ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { Callout } from './Callout'
import { ComparisonTable } from './ComparisonTable'
import { CodeBlock } from './CodeBlock'

function extractTextFromReactNode(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join('')
  if (typeof node === 'object' && 'props' in node) {
    const el = node as { props: { children?: ReactNode } }
    return extractTextFromReactNode(el.props.children)
  }
  return ''
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Dark-mode MDX renderer. Mirrors the light components but tuned for the
// zinc-950 reading frame the doc pages live inside.
export const darkMdxComponents: MDXComponents = {
  h1: ({ children }) => (
    <h1 className="text-[32px] md:text-[40px] font-black tracking-tight text-zinc-50 leading-[1.1] mb-4">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const text = extractTextFromReactNode(children)
    const id = slugify(text)
    return (
      <h2
        id={id}
        className="scroll-mt-24 pt-8 mt-12 mb-4 text-[22px] md:text-[26px] font-bold tracking-tight text-zinc-100 leading-[1.2]"
      >
        {children}
      </h2>
    )
  },
  h3: ({ children }) => (
    <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-zinc-100 mt-8 mb-3">
      {children}
    </h3>
  ),

  p: ({ children }) => (
    <p className="text-[15px] text-zinc-300 leading-relaxed mb-4">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-50">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-zinc-200">{children}</em>
  ),

  ul: ({ children }) => (
    <ul className="list-disc ml-5 space-y-2 text-[15px] text-zinc-300 leading-relaxed mb-4 marker:text-zinc-600">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal ml-5 space-y-2 text-[15px] text-zinc-300 leading-relaxed mb-4 marker:text-zinc-500 marker:font-mono">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1.5">{children}</li>,

  a: ({ href, children, ...props }) => {
    if (href && href.startsWith('/')) {
      return (
        <Link
          href={href}
          className="text-emerald-400 font-medium border-b border-emerald-400/40 hover:border-emerald-300 hover:text-emerald-300 transition-colors"
        >
          {children}
        </Link>
      )
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-400 font-medium border-b border-emerald-400/40 hover:border-emerald-300 hover:text-emerald-300 transition-colors"
        {...props}
      >
        {children}
      </a>
    )
  },

  table: ({ children }) => (
    <div className="border border-zinc-800 overflow-x-auto my-8 rounded-sm">
      <table className="w-full text-[14px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => (
    <th className="text-left bg-zinc-900 text-zinc-200 text-[11px] font-semibold tracking-[0.08em] uppercase px-5 py-3 border-b border-zinc-800">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-5 py-3.5 text-[14px] text-zinc-300 border-t border-zinc-800/70">
      {children}
    </td>
  ),

  code: ({ children }) => (
    <code className="bg-zinc-900 text-[13px] font-mono px-1.5 py-0.5 text-emerald-300 rounded-sm border border-zinc-800">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="bg-zinc-950 text-zinc-100 border border-zinc-800 overflow-x-auto p-5 my-8 text-[13px] font-mono leading-relaxed rounded-sm">
      {children}
    </pre>
  ),

  blockquote: ({ children }) => (
    <blockquote className="border-l-[3px] border-emerald-400/60 bg-zinc-900/40 px-6 py-5 my-8 text-[15px] text-zinc-200 leading-relaxed italic">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-12 border-t border-zinc-800" />,

  Callout,
  ComparisonTable,
  CodeBlock,
}
