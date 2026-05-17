import { cookies, headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { createHash } from 'node:crypto'
import { dataroomMdxComponents } from '@/lib/dataroom/mdx'
import { SESSION_COOKIE, verifySession } from '@/lib/dataroom/session'
import { getRoom, logView } from '@/lib/dataroom/db'
import { getRoomPage, listRoomPages, roomExists } from '@/lib/dataroom/content'
import { ROOM_SLUG } from '@/lib/dataroom/config'
import { RoomShell } from '../RoomShell'

interface Props {
  params: Promise<{ page: string }>
}

function hash(s: string | null | undefined): string | null {
  if (!s) return null
  return createHash('sha256').update(s).digest('hex').slice(0, 32)
}

export default async function RoomInnerPage({ params }: Props) {
  const { page } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const session = token ? await verifySession(token) : null
  const room = await getRoom(ROOM_SLUG)

  if (!session || session.slug !== ROOM_SLUG || !room) {
    redirect('/room')
  }

  if (!roomExists()) notFound()

  const pageDoc = getRoomPage(page)
  if (!pageDoc) notFound()

  const pages = listRoomPages()
  const h = await headers()
  await logView({
    slug: ROOM_SLUG,
    page,
    jti: session.jti,
    ipHash: hash(h.get('x-forwarded-for') ?? h.get('x-real-ip')),
    uaHash: hash(h.get('user-agent')),
  })

  return (
    <RoomShell title={room.title} pages={pages} currentPageSlug={page}>
      <MDXRemote
        source={pageDoc.content}
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
