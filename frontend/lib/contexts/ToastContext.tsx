'use client'

import { createContext, useContext, useCallback, useState, ReactNode } from 'react'
import { ToastContainer, ToastData, ToastType } from '@/components/ui/Toast'

interface ToastContextValue {
  showToast: (type: ToastType, message: string, link?: { url: string; text: string }) => void
  showSuccess: (message: string, link?: { url: string; text: string }) => void
  showError: (message: string) => void
  showInfo: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Hook to access toast notification functions
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

/**
 * Provider component for toast notifications
 * Manages toast state and renders the toast container
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (type: ToastType, message: string, link?: { url: string; text: string }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newToast: ToastData = {
        id,
        type,
        message,
        link,
        duration: type === 'error' ? 8000 : 5000
      }
      setToasts((prev) => [...prev, newToast])
    },
    []
  )

  const showSuccess = useCallback(
    (message: string, link?: { url: string; text: string }) => {
      showToast('success', message, link)
    },
    [showToast]
  )

  const showError = useCallback(
    (message: string) => {
      showToast('error', message)
    },
    [showToast]
  )

  const showInfo = useCallback(
    (message: string) => {
      showToast('info', message)
    },
    [showToast]
  )

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}
