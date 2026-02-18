/**
 * Hook for Telegram wallet verification flow
 *
 * Story 6-3: Handles the wallet signature verification for linking
 * Telegram accounts to wallet addresses.
 */

'use client'

import { useState, useCallback } from 'react'
import { useAccount, useSignMessage } from 'wagmi'

// Use relative path to go through Vercel rewrites to production backend
const BACKEND_URL = ''

interface VerificationState {
  status: 'idle' | 'loading' | 'signing' | 'verifying' | 'success' | 'error'
  error: string | null
  telegramUserId: number | null
}

interface CodeInfo {
  telegramUserId: number
}

export function useTelegramVerification() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [state, setState] = useState<VerificationState>({
    status: 'idle',
    error: null,
    telegramUserId: null,
  })

  /**
   * Lookup verification code to get Telegram user ID
   */
  const lookupCode = useCallback(async (code: string): Promise<CodeInfo | null> => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/telegram/code/${code}`)
      if (!res.ok) {
        if (res.status === 404) {
          setState(prev => ({ ...prev, status: 'error', error: 'Invalid or expired verification code' }))
          return null
        }
        throw new Error('Failed to lookup code')
      }
      const data: CodeInfo = await res.json()
      setState(prev => ({ ...prev, telegramUserId: data.telegramUserId }))
      return data
    } catch (error) {
      console.error('Error looking up code:', error)
      setState(prev => ({ ...prev, status: 'error', error: 'Failed to verify code' }))
      return null
    }
  }, [])

  /**
   * Complete the verification flow:
   * 1. Lookup code to get Telegram user ID
   * 2. Sign message with wallet
   * 3. Submit signature to backend for verification
   */
  const verify = useCallback(async (code: string) => {
    if (!isConnected || !address) {
      setState(prev => ({ ...prev, status: 'error', error: 'Please connect your wallet first' }))
      return false
    }

    setState({ status: 'loading', error: null, telegramUserId: null })

    try {
      // 1. Lookup code to get Telegram user ID
      const codeInfo = await lookupCode(code)
      if (!codeInfo) {
        return false
      }

      setState(prev => ({
        ...prev,
        status: 'signing',
        telegramUserId: codeInfo.telegramUserId,
      }))

      // 2. Create and sign message
      const timestamp = Math.floor(Date.now() / 1000)
      const message = `AgiArena Telegram Link: ${codeInfo.telegramUserId} at ${timestamp}`

      let signature: string
      try {
        signature = await signMessageAsync({ message })
      } catch (signError) {
        console.error('User rejected signature:', signError)
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Signature rejected. Please try again.',
        }))
        return false
      }

      setState(prev => ({ ...prev, status: 'verifying' }))

      // 3. Submit to backend for verification
      const res = await fetch(`${BACKEND_URL}/api/telegram/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          walletAddress: address,
          signature,
          timestamp,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Verification failed')
      }

      setState(prev => ({
        ...prev,
        status: 'success',
      }))

      return true
    } catch (error) {
      console.error('Verification error:', error)
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Verification failed',
      }))
      return false
    }
  }, [isConnected, address, signMessageAsync, lookupCode])

  /**
   * Reset state for new verification attempt
   */
  const reset = useCallback(() => {
    setState({
      status: 'idle',
      error: null,
      telegramUserId: null,
    })
  }, [])

  return {
    ...state,
    isConnected,
    walletAddress: address,
    verify,
    reset,
    lookupCode,
  }
}
