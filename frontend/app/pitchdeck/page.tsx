import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { dataroomMdxComponents } from '@/lib/dataroom/mdx'
import { getPitchdeck } from '@/lib/dataroom/content'

export default async function PitchdeckPage() {
  const deck = getPitchdeck()
  if (!deck) notFound()

  return (
    <main className="min-h-screen">
      <article className="max-w-[820px] mx-auto px-6 md:px-12 py-16 md:py-24">
        <MDXRemote
          source={deck.content}
          components={dataroomMdxComponents}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [rehypeHighlight],
            },
          }}
        />
      </article>
    </main>
  )
}
