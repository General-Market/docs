import { describe, test, expect } from 'bun:test'
import type { SSEState } from '@/hooks/useLeaderboardSSE'

describe('ConnectionStatusIndicator', () => {
  describe('state configuration', () => {
    const stateConfig: Record<SSEState, { color: string; text: string | ((attempt: number) => string) }> = {
      connected: { color: 'bg-green-400', text: 'Live' },
      connecting: { color: 'bg-yellow-400 animate-pulse', text: (attempt) => attempt > 0 ? `Reconnecting (${attempt})...` : 'Connecting...' },
      error: { color: 'bg-yellow-400 animate-pulse', text: (attempt) => `Reconnecting (${attempt})...` },
      disconnected: { color: 'bg-red-400', text: 'Offline' },
      disabled: { color: 'bg-white/40', text: 'Disabled' },
      polling: { color: 'bg-yellow-400', text: 'Polling' }
    }

    test('connected state shows green dot and "Live" text', () => {
      const config = stateConfig['connected']
      expect(config.color).toBe('bg-green-400')
      expect(config.text).toBe('Live')
    })

    test('connecting state shows yellow pulsing dot', () => {
      const config = stateConfig['connecting']
      expect(config.color).toContain('bg-yellow-400')
      expect(config.color).toContain('animate-pulse')
    })

    test('connecting state shows "Connecting..." for attempt 0', () => {
      const config = stateConfig['connecting']
      const text = typeof config.text === 'function' ? config.text(0) : config.text
      expect(text).toBe('Connecting...')
    })

    test('connecting state shows reconnect count for attempt > 0', () => {
      const config = stateConfig['connecting']
      const text = typeof config.text === 'function' ? config.text(2) : config.text
      expect(text).toBe('Reconnecting (2)...')
    })

    test('error state shows reconnect count', () => {
      const config = stateConfig['error']
      const text = typeof config.text === 'function' ? config.text(3) : config.text
      expect(text).toBe('Reconnecting (3)...')
    })

    test('disconnected state shows red dot and "Offline" text', () => {
      const config = stateConfig['disconnected']
      expect(config.color).toBe('bg-red-400')
      expect(config.text).toBe('Offline')
    })

    test('disabled state shows gray dot and "Disabled" text', () => {
      const config = stateConfig['disabled']
      expect(config.color).toBe('bg-white/40')
      expect(config.text).toBe('Disabled')
    })

    test('polling state shows yellow dot and "Polling" text', () => {
      const config = stateConfig['polling']
      expect(config.color).toBe('bg-yellow-400')
      expect(config.text).toBe('Polling')
    })
  })

  describe('all SSE states have configuration', () => {
    const allStates: SSEState[] = ['connecting', 'connected', 'disconnected', 'error', 'disabled', 'polling']

    test('every SSEState has a configuration entry', () => {
      const stateConfig: Record<SSEState, { color: string; text: string | ((attempt: number) => string) }> = {
        connected: { color: 'bg-green-400', text: 'Live' },
        connecting: { color: 'bg-yellow-400 animate-pulse', text: (attempt) => attempt > 0 ? `Reconnecting (${attempt})...` : 'Connecting...' },
        error: { color: 'bg-yellow-400 animate-pulse', text: (attempt) => `Reconnecting (${attempt})...` },
        disconnected: { color: 'bg-red-400', text: 'Offline' },
        disabled: { color: 'bg-white/40', text: 'Disabled' },
        polling: { color: 'bg-yellow-400', text: 'Polling' }
      }

      for (const state of allStates) {
        expect(stateConfig[state]).toBeDefined()
        expect(stateConfig[state].color).toBeTruthy()
        expect(stateConfig[state].text).toBeTruthy()
      }
    })
  })
})
