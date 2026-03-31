import { resolveIcon } from '@/lib/vision/icon-resolver'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ source: string; id: string[] }> },
) {
  const { source, id } = await params
  return resolveIcon([source, ...id])
}
