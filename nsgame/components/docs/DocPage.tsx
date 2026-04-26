import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { Link } from '@/i18n/routing'
import { darkMdxComponents } from '@/components/mdx/dark'
import type { LoadedDoc, DocSection } from '@/lib/content/loadDoc'

interface DocPageProps {
  doc: LoadedDoc
  section: DocSection
  sectionLabel: string
  sectionHref: string
}

export function DocPage({ doc, section, sectionLabel, sectionHref }: DocPageProps) {
  const { frontmatter, body } = doc

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-12 sm:pt-16">
        <div className="mb-10">
          <Link
            href={sectionHref}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            ← {sectionLabel}
          </Link>
        </div>

        <header className="mb-10 pb-8 border-b border-zinc-800">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3">
            {frontmatter.category}
          </p>
          <h1 className="text-[34px] sm:text-[40px] font-black tracking-tight text-zinc-50 leading-[1.05] mb-4">
            {frontmatter.title}
          </h1>
          {frontmatter.description ? (
            <p className="text-[16px] text-zinc-400 leading-relaxed max-w-2xl">
              {frontmatter.description}
            </p>
          ) : null}
        </header>

        <article>
          <MDXRemote
            source={body}
            components={darkMdxComponents}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
              },
            }}
          />
        </article>

        <footer className="mt-16 pt-8 border-t border-zinc-800 flex items-center justify-between">
          <Link
            href={sectionHref}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            ← {sectionLabel}
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            {section}/{frontmatter.slug}
          </span>
        </footer>
      </div>
    </main>
  )
}
