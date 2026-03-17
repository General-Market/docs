export async function GET() {
  const url = process.env.ORACLE_VISION_URL || 'NOT_SET'
  try {
    const res = await fetch(`${url}/vision/batches`, { signal: AbortSignal.timeout(5000) })
    return Response.json({ oracle_url: url, status: res.status, ok: res.ok })
  } catch (e: any) {
    return Response.json({ oracle_url: url, error: e.message })
  }
}
