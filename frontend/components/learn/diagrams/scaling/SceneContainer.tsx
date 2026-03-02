'use client'

import { useRef, useState, useEffect, useCallback, ReactNode } from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { usePrefersReducedMotion } from '@/hooks/useMediaQueries'

/* -- Types -- */

interface SceneContainerProps {
  children: (props: { reducedMotion: boolean }) => ReactNode
  height: string
  ariaLabel: string
  srDescription: string
  legend: ReactNode
  fallbackText: string
}

/* -- WebGL detection -- */

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

/* -- No-WebGL fallback -- */

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

/* -- Context-loss recovery UI -- */

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

/* -- Error fallback for ErrorBoundary -- */

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

/* -- Main component -- */

export function SceneContainer({
  children,
  height,
  ariaLabel,
  srDescription,
  legend,
  fallbackText,
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

  // Single IntersectionObserver: mount at 200px margin, unmount with getBoundingClientRect check
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true)
        } else {
          // Check if element is more than 200px outside viewport before unmounting
          const rect = el.getBoundingClientRect()
          const viewportHeight = window.innerHeight
          const viewportWidth = window.innerWidth
          const outsideTop = rect.bottom < -200
          const outsideBottom = rect.top > viewportHeight + 200
          const outsideLeft = rect.right < -200
          const outsideRight = rect.left > viewportWidth + 200

          if (outsideTop || outsideBottom || outsideLeft || outsideRight) {
            setMounted(false)
          }
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
    }
  }, [])

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
