import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  pw: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>

const KEYLEN = 32
const SALT_BYTES = 16

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 64)
}

export async function hashCode(code: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const derived = await scrypt(normalizeCode(code), salt, KEYLEN)
  return { hash: derived.toString('hex'), salt }
}

export async function verifyCode(code: string, hash: string, salt: string): Promise<boolean> {
  const derived = await scrypt(normalizeCode(code), salt, KEYLEN)
  const stored = Buffer.from(hash, 'hex')
  if (derived.length !== stored.length) return false
  return timingSafeEqual(derived, stored)
}

export function generateCode(words = 3): string {
  // Generate a memorable code: ABCD-EFGH-IJKL (12 chars, 3 groups)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const groups: string[] = []
  for (let g = 0; g < words; g++) {
    let s = ''
    const buf = randomBytes(4)
    for (let i = 0; i < 4; i++) s += alphabet[buf[i] % alphabet.length]
    groups.push(s)
  }
  return groups.join('-')
}
