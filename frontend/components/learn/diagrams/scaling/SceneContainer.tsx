'use client'

import { useRef, useState, useEffect, useCallback, ReactNode } from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { usePrefersReducedMotion } from '@/hooks/useMediaQueries'

/* ── Types ── */

interface SceneContainerProps {
  children: (props: { reducedMotion: boolean }) => ReactNode
  height: string
  ariaLabel: string
  srDescription: string
  legend: ReactNode
  fallbackText: string
  rootMarginMount?: string
  rootMarginUnmount?: string
}

/* ── WebGL detection ── */

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return gl !== null
  } catch {
    return false
  }
}

/* ── No-WebGL fallback ── */

function NoWebGLFallback({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center bg-zinc-50">
      <div className="text-center px-6">
        <p className="text-sm text-text-secondary font-medium">{text}</p>
        <p className="text-xs text-text-muted mt-1">
          WebGL is not available in your browser.
        </p>
      </div>
    </div>
  )
}

/* ── Context-loss recovery UI ── */

function ContextLostOverlay({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
      <div className="text-center px-6">
        <p className="text-sm text-text-secondary font-medium">
          3D context was lost
        </p>
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-1.5 text-xs font-medium border border-border-medium rounded-md hover:bg-zinc-50 transition-colors"
        >
          Reload scene
        </button>
      </div>
    </div>
  )
}

/* ── Error fallback for ErrorBoundary ── */

function SceneErrorFallback({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center bg-zinc-50">
      <div className="text-center px-6">
        <p className="text-sm text-text-secondary font-medium">{text}</p>
        <p className="text-xs text-text-muted mt-1">
          An error occurred rendering this diagram.
        </p>
      </div>
    </div>
  )
}

/* ── Main component ── */

export function SceneContainer({
  children,
  height,
  ariaLabel,
  srDescription,
  legend,
  fallbackText,
  rootMarginMount = '200px',
  rootMarginUnmount = '600px',
}: SceneContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  const [mounted, setMounted] = useState(false)
  const [hasWebGL, setHasWebGL] = useState(true)
  const [contextLost, setContextLost] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  // WebGL detection on client mount
  useEffect(() => {
    setHasWebGL(detectWebGL())
  }, [])

  // IntersectionObserver: mount when approaching viewport, unmount when far past
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Mount observer: trigger mount when element is within rootMarginMount
    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true)
        }
      },
      { rootMargin: rootMarginMount }
    )

    // Unmount observer: trigger unmount when element leaves a larger margin
    const unmountObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setMounted(false)
        }
      },
      { rootMargin: rootMarginUnmount }
    )

    mountObserver.observe(el)
    unmountObserver.observe(el)

    return () => {
      mountObserver.disconnect()
      unmountObserver.disconnect()
    }
  }, [rootMarginMount, rootMarginUnmount])

  // WebGL context loss listener
  useEffect(() => {
    const wrap = canvasWrapRef.current
    if (!wrap || !mounted) return

    const handleContextLost = (e: Event) => {
      e.preventDefault()
      setContextLost(true)
    }

    const handleContextRestored = () => {
      setContextLost(false)
    }

    // The canvas element is created by R3F inside our wrapper
    // Listen on the wrapper and let events bubble
    wrap.addEventListener('webglcontextlost', handleContextLost, true)
    wrap.addEventListener('webglcontextrestored', handleContextRestored, true)

    return () => {
      wrap.removeEventListener('webglcontextlost', handleContextLost, true)
      wrap.removeEventListener('webglcontextrestored', handleContextRestored, true)
    }
  }, [mounted])

  const handleRetry = useCallback(() => {
    setContextLost(false)
    setRetryKey((k) => k + 1)
  }, [])

  return (
    <div className="my-12 -mx-4 md:-mx-8" ref={containerRef}>
      <div className="bg-white border-t-[3px] border-b border-black border-b-border-light">
        <div className="sr-only">{srDescription}</div>
        <div
          className={`${height} relative`}
          role="img"
          aria-label={ariaLabel}
          style={{ touchAction: 'pan-y' }}
        >
          {!hasWebGL ? (
            <NoWebGLFallback text={fallbackText} />
          ) : !mounted ? (
            <div className="h-full animate-pulse bg-zinc-50" />
          ) : (
            <ErrorBoundary
              fallback={<SceneErrorFallback text={fallbackText} />}
            >
              <div
                ref={canvasWrapRef}
                className="h-full cursor-grab active:cursor-grabbing"
                key={retryKey}
              >
                {contextLost && (
                  <ContextLostOverlay onRetry={handleRetry} />
                )}
                {children({ reducedMotion })}
              </div>
            </ErrorBoundary>
          )}
        </div>
        <div className="px-6 pb-3 pt-1 flex items-center justify-between border-t border-zinc-200">
          {legend}
          <span className="text-[10px] text-text-muted font-mono">
            drag to orbit
          </span>
        </div>
      </div>
    </div>
  )
}
