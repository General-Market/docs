import Link from 'next/link'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { loadDoc } from '@/lib/content/loadDoc'
import { darkMdxComponents } from '@/components/mdx/dark'

// Dark-native 404. Pulls copy from content/nsgame/plumbing/404.mdx so the
// language stays editable without a redeploy story for prose changes.
export default function NotFound() {
  const doc = loadDoc('plumbing', '404')

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3">
          404
        </p>
        {doc ? (
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
        ) : (
          <>
            <h1 className="text-[28px] font-semibold tracking-tight text-zinc-50 leading-tight">
              The page you wanted is not here<span className="text-rose-500">.</span>
            </h1>
            <p className="mt-3 text-[14px] text-zinc-400">
              Maybe it was here once. Maybe a slug changed. Whichever it
              is, it is gone.
            </p>
          </>
        )}
        <div className="mt-8 flex gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-200 hover:border-zinc-500 hover:text-zinc-50 transition-colors"
          >
            ← back to nsgame
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            help center
          </Link>
        </div>
      </div>
    </main>
  )
}
