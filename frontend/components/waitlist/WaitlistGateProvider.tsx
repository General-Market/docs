'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { AnimatePresence } from 'framer-motion'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { WaitlistModal } from './WaitlistModal'
import { useWaitlistStatus, clearWaitlistCache } from '@/hooks/useWaitlistStatus'

type GateAction = () => void

interface WaitlistGateContextValue {
  open: () => void
  close: () => void
  requireWhitelist: (action: GateAction) => boolean
  isOpen: boolean
}

const WaitlistGateContext = createContext<WaitlistGateContextValue | null>(null)

export function useWaitlistGate(): WaitlistGateContextValue {
  const ctx = useContext(WaitlistGateContext)
  if (!ctx) {
    throw new Error('useWaitlistGate must be used inside WaitlistGateProvider')
  }
  return ctx
}

export function WaitlistGateProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const { whitelisted, refresh, invalidate } = useWaitlistStatus()
  const [isOpen, setIsOpen] = useState(false)
  const pendingActionRef = useRef<GateAction | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const open = useCallback(() => setIsOpen(true), [])

  // ?waitlist=1 (any value) opens the modal once, then the param is stripped
  // so a refresh does not re-open. The /waitlist marketing route redirects
  // here, so this is the only entry point that survives.
  useEffect(() => {
    if (!searchParams) return
    if (!searchParams.has('waitlist')) return
    setIsOpen(true)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('waitlist')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [searchParams, pathname, router])

  const close = useCallback(() => {
    setIsOpen(false)
    pendingActionRef.current = null
  }, [])

  const requireWhitelist = useCallback(
    (action: GateAction) => {
      if (whitelisted) {
        action()
        return true
      }
      pendingActionRef.current = action
      setIsOpen(true)
      return false
    },
    [whitelisted],
  )

  const handleRedeemed = useCallback(() => {
    if (address) clearWaitlistCache(address)
    void refresh()
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setIsOpen(false)
    if (action) {
      setTimeout(action, 200)
    }
  }, [address, refresh])

  useEffect(() => {
    if (whitelisted === true && isOpen) {
      const action = pendingActionRef.current
      pendingActionRef.current = null
      setIsOpen(false)
      if (action) setTimeout(action, 100)
    }
  }, [whitelisted, isOpen])

  const value = useMemo<WaitlistGateContextValue>(
    () => ({ open, close, requireWhitelist, isOpen }),
    [open, close, requireWhitelist, isOpen],
  )

  return (
    <WaitlistGateContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <WaitlistModal
            onClose={close}
            onRedeemed={handleRedeemed}
            onWalletConnected={() => { invalidate() }}
          />
        )}
      </AnimatePresence>
    </WaitlistGateContext.Provider>
  )
}
