import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { loadDoc } from '@/lib/content/loadDoc'
import { buildSectionMetadata } from '@/lib/content/metadata'
import { darkMdxComponents } from '@/components/mdx/dark'
import { Footer } from '@/components/layout/Footer'

export function generateMetadata() {
  const home = loadDoc('help', 'help-center-home')
  return buildSectionMetadata(
    'help',
    home?.frontmatter.title ?? 'Help Center',
    home?.frontmatter.description ??
      'Guides and answers for nsgame — a DAO-governed parimutuel prediction market on Solana.',
  )
}

export default function HelpIndexPage() {
  const home = loadDoc('help', 'help-center-home')
  if (!home) notFound()

  return (
    <>
      <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
        <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-12 sm:pt-16">
          <header className="mb-10 pb-8 border-b border-zinc-800">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3">
              {home.frontmatter.category}
            </p>
            <h1 className="text-[34px] sm:text-[44px] font-black tracking-tight text-zinc-50 leading-[1.05] mb-4">
              {home.frontmatter.title}
            </h1>
            <p className="text-[16px] text-zinc-400 leading-relaxed max-w-2xl">
              {home.frontmatter.description}
            </p>
          </header>

          <article>
            <MDXRemote
              source={home.body}
              components={darkMdxComponents}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                },
              }}
            />
          </article>
        </div>
      </main>
      <Footer />
    </>
  )
}
