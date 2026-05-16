import { SignJWT, jwtVerify } from 'jose'
import { randomUUID } from 'node:crypto'

export const SESSION_COOKIE = 'dataroom_session'
const ALG = 'HS256'

function secret(): Uint8Array {
  const s = process.env.DATAROOM_JWT_SECRET
  if (!s || s.length < 32) {
    throw new Error('DATAROOM_JWT_SECRET must be set and at least 32 chars')
  }
  return new TextEncoder().encode(s)
}

export interface DataroomClaims {
  slug: string
  jti: string
  iat: number
  exp: number
}

export async function issueSession(slug: string, ttlSeconds = 60 * 60 * 24 * 30): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const jti = randomUUID()
  return await new SignJWT({ slug })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setJti(jti)
    .sign(secret())
}

export async function verifySession(token: string): Promise<DataroomClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] })
    if (typeof payload.slug !== 'string' || typeof payload.jti !== 'string') return null
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return null
    return { slug: payload.slug, jti: payload.jti, iat: payload.iat, exp: payload.exp }
  } catch {
    return null
  }
}
