import NextLink from 'next/link'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { mdxComponents } from '@/components/mdx'

function PlainAnchor({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) {
  if (href && href.startsWith('/')) {
    return (
      <NextLink
        href={href}
        className="text-black font-semibold border-b border-black/30 hover:border-black transition-colors"
      >
        {children}
      </NextLink>
    )
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
  )
}

export const dataroomMdxComponents = {
  ...mdxComponents,
  a: PlainAnchor,
}
