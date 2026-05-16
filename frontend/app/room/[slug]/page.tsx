import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { createHash } from 'node:crypto'
import { dataroomMdxComponents } from '@/lib/dataroom/mdx'
import { SESSION_COOKIE, verifySession } from '@/lib/dataroom/session'
import { getRoom, logView } from '@/lib/dataroom/db'
import { getRoomPage, listRoomPages, roomExists } from '@/lib/dataroom/content'
import { UnlockForm } from './UnlockForm'
import { AutoUnlock } from './AutoUnlock'
import { RoomShell } from './RoomShell'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ k?: string; error?: string }>
}

function hash(s: string | null | undefined): string | null {
  if (!s) return null
  return createHash('sha256').update(s).digest('hex').slice(0, 32)
}

export default async function RoomSlugPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const room = await getRoom(slug)
  const title = room?.title ?? 'Data Room'

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const session = token ? await verifySession(token) : null
  const authed = session !== null && session.slug === slug && room !== null

  if (!authed) {
    if (sp.k) {
      return <AutoUnlock slug={slug} code={sp.k} />
    }
    return <UnlockForm slug={slug} title={title} initialError={sp.error} />
  }

  if (!roomExists(slug)) {
    notFound()
  }

  const pages = listRoomPages(slug)
  const indexPage = getRoomPage(slug, 'index') ?? pages[0]
  if (!indexPage) notFound()

  const h = await headers()
  await logView({
    slug,
    page: indexPage.pageSlug,
    jti: session.jti,
    ipHash: hash(h.get('x-forwarded-for') ?? h.get('x-real-ip')),
    uaHash: hash(h.get('user-agent')),
  })

  return (
    <RoomShell slug={slug} title={title} pages={pages} currentPageSlug={null}>
      <MDXRemote
        source={indexPage.content}
        components={dataroomMdxComponents}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeHighlight],
          },
        }}
      />
    </RoomShell>
  )
}
