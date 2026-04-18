'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  VersionedTransaction,
  sendAndConfirmRawTransaction,
} from '@solana/web3.js'
import { useWallet } from '@/hooks/useWallet'
import {
  buildDisableSessionTx,
  buildEnableSessionTx,
  deriveSessionKeypair,
  type SessionConfig,
} from './session'

// Skip the funding transaction if the session key already has at least
// this fraction of the requested funding on chain. Lets reloads rehydrate
// without paying a second on-chain tx.
const REHYDRATE_THRESHOLD = 0.5

// Session state lives only in memory (a useRef holds the Keypair so it never
// leaks into React devtools). Closing the tab terminates the session.

interface SessionMeta {
  spendingCap: bigint | null
  tokenMint: string | null
  userTokenAccount: string | null
  expiresAt: number | null
  enabledAt: number
}

interface SessionContextValue {
  enabled: boolean
  enabling: boolean
  disabling: boolean
  sessionPublicKey: string | null
  meta: SessionMeta | null
  enable: (config: SessionConfig, opts?: { durationMs?: number }) => Promise<string | null>
  disable: () => Promise<string | null>
  // Sign + broadcast with the session key if one is active, otherwise fall
  // through to the main wallet. Returns the signature (tx id).
  signAndSend: (tx: Transaction | VersionedTransaction) => Promise<string>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, signAndSendTransaction, connection } = useWallet()
  const sessionRef = useRef<Keypair | null>(null)
  const [meta, setMeta] = useState<SessionMeta | null>(null)
  const [enabling, setEnabling] = useState(false)
  const [disabling, setDisabling] = useState(false)

  const enable = useCallback(
    async (config: SessionConfig, opts?: { durationMs?: number }): Promise<string | null> => {
      if (!publicKey) throw new Error('Connect a wallet first')
      setEnabling(true)
      try {
        // Derive a deterministic session keypair from a wallet-signed
        // message. Same wallet + same message = same key on every reload.
        const kp = await deriveSessionKeypair(publicKey, signMessage)

        // If the session key already has enough SOL on chain (a previous
        // tab funded it), skip the funding tx. One signature, no chain tx.
        const currentLamports = await connection.getBalance(kp.publicKey, 'confirmed')
        const neededLamports = Math.floor(config.solFunding * LAMPORTS_PER_SOL)
        const skipFunding =
          neededLamports === 0 ||
          currentLamports >= Math.floor(neededLamports * REHYDRATE_THRESHOLD)

        let signature: string | null = null
        if (!skipFunding) {
          const tx = buildEnableSessionTx(publicKey, kp.publicKey, config)
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
          tx.recentBlockhash = blockhash
          tx.feePayer = publicKey
          signature = await signAndSendTransaction(tx)
          await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed',
          )
        }

        sessionRef.current = kp
        setMeta({
          spendingCap: config.spendingCap ?? null,
          tokenMint: config.tokenMint?.toBase58() ?? null,
          userTokenAccount: config.userTokenAccount?.toBase58() ?? null,
          expiresAt: opts?.durationMs ? Date.now() + opts.durationMs : null,
          enabledAt: Date.now(),
        })
        return signature
      } finally {
        setEnabling(false)
      }
    },
    [publicKey, signMessage, signAndSendTransaction, connection],
  )

  const disable = useCallback(async (): Promise<string | null> => {
    if (!publicKey || !meta) {
      sessionRef.current = null
      setMeta(null)
      return null
    }
    setDisabling(true)
    try {
      const ata = meta.userTokenAccount ? new PublicKey(meta.userTokenAccount) : undefined
      const tx = buildDisableSessionTx(publicKey, ata)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = publicKey

      const signature = await signAndSendTransaction(tx)
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      )
      sessionRef.current = null
      setMeta(null)
      return signature
    } finally {
      setDisabling(false)
    }
  }, [publicKey, meta, signAndSendTransaction, connection])

  const signAndSend = useCallback(
    async (tx: Transaction | VersionedTransaction): Promise<string> => {
      const session = sessionRef.current
      const sessionLive = session && meta && (!meta.expiresAt || Date.now() < meta.expiresAt)

      // No session, or session expired — use main wallet.
      if (!sessionLive || !session) {
        return signAndSendTransaction(tx)
      }

      // VersionedTransaction requires a different signing path. For now the
      // session flow supports legacy Transaction only; trade builders can
      // opt out by using the main wallet when they need v0 tables.
      if (!(tx instanceof Transaction)) {
        return signAndSendTransaction(tx)
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = session.publicKey
      tx.sign(session)
      const raw = tx.serialize()
      const signature = await sendAndConfirmRawTransaction(connection, Buffer.from(raw), {
        commitment: 'confirmed',
      })
      void lastValidBlockHeight
      return signature
    },
    [meta, connection, signAndSendTransaction],
  )

  const value = useMemo<SessionContextValue>(
    () => ({
      enabled: !!meta,
      enabling,
      disabling,
      sessionPublicKey: sessionRef.current?.publicKey.toBase58() ?? null,
      meta,
      enable,
      disable,
      signAndSend,
    }),
    [meta, enabling, disabling, enable, disable, signAndSend],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside a SessionProvider')
  return ctx
}
