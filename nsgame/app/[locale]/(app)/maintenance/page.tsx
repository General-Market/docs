import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { loadDoc } from '@/lib/content/loadDoc'
import { darkMdxComponents } from '@/components/mdx/dark'

export function generateMetadata() {
  return {
    title: 'Maintenance · nsgame',
    description: 'The website is down on purpose. The protocol is not.',
    robots: { index: false, follow: false },
  }
}

export default function MaintenancePage() {
  const doc = loadDoc('plumbing', 'maintenance')
  if (!doc) notFound()

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-4">
          Status — Maintenance
        </p>
        <article>
          <MDXRemote
            source={doc.body}
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
  )
}
