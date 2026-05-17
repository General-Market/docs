import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { PrivateKeyAccount } from 'viem'
import { KEYS_PATH, KEYRING_SIZE } from './config.js'
import { log } from './log.js'

export type Keyring = { account: PrivateKeyAccount; pk: `0x${string}` }[]

export function loadOrCreateKeyring(): Keyring {
  if (!existsSync(KEYS_PATH)) {
    log.warn({ path: KEYS_PATH, size: KEYRING_SIZE }, 'no keyring — generating')
    const pks: `0x${string}`[] = []
    for (let i = 0; i < KEYRING_SIZE; i++) pks.push(generatePrivateKey())
    writeFileSync(KEYS_PATH, JSON.stringify({ keys: pks }, null, 2), { mode: 0o600 })
    try { chmodSync(KEYS_PATH, 0o600) } catch { /* best effort on volume mounts */ }
    log.warn({ path: KEYS_PATH }, 'keyring written — FUND THE ADDRESSES BELOW')
  }
  const data = JSON.parse(readFileSync(KEYS_PATH, 'utf8')) as { keys: `0x${string}`[] }
  const ring: Keyring = data.keys.map((pk) => ({ pk, account: privateKeyToAccount(pk) }))
  for (const k of ring) {
    log.info({ address: k.account.address }, 'wallet loaded')
  }
  return ring
}
