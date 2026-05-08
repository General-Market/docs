'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Pixel width per card. The row scrolls in increments roughly equal to viewport width. */
  cardWidth?: number
  cardWidthMobile?: number
  gap?: number
}

/**
 * Horizontal scroll row with snap, hidden scrollbar, and floating chevron
 * buttons that appear only when there's overflow in that direction.
 * Mirrors the YouTube/Netflix shelf pattern — Apple keeps the chrome quiet.
 */
export function ScrollRow({
  children,
  cardWidth = 296,
  cardWidthMobile = 240,
  gap = 20,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [canBack, setCanBack] = useState(false)
  const [canFwd, setCanFwd] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanBack(el.scrollLeft > 4)
    setCanFwd(el.scrollLeft < max - 4)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [update])

  const nudge = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    const step = Math.max(cardWidth + gap, el.clientWidth * 0.85)
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        className="row-scroller flex overflow-x-auto pb-1 snap-x"
        style={{
          gap,
          scrollSnapType: 'x mandatory',
          scrollPaddingLeft: 4,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <RowChildrenWrapper width={cardWidth} widthMobile={cardWidthMobile}>
          {children}
        </RowChildrenWrapper>
      </div>

      <ChevronButton
        direction="back"
        visible={canBack}
        onClick={() => nudge(-1)}
      />
      <ChevronButton
        direction="forward"
        visible={canFwd}
        onClick={() => nudge(1)}
      />

      <style jsx>{`
        .row-scroller::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}

function RowChildrenWrapper({
  children,
  width,
  widthMobile,
}: {
  children: ReactNode
  width: number
  widthMobile: number
}) {
  return (
    <>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <RowItem key={i} width={width} widthMobile={widthMobile}>
              {child}
            </RowItem>
          ))
        : (
            <RowItem width={width} widthMobile={widthMobile}>
              {children}
            </RowItem>
          )}
    </>
  )
}

function RowItem({
  children,
  width,
  widthMobile,
}: {
  children: ReactNode
  width: number
  widthMobile: number
}) {
  return (
    <div
      className="row-item shrink-0"
      style={{
        scrollSnapAlign: 'start',
      }}
    >
      <div className="card-frame">{children}</div>
      <style jsx>{`
        .card-frame {
          width: ${widthMobile}px;
        }
        @media (min-width: 768px) {
          .card-frame {
            width: ${width}px;
          }
        }
      `}</style>
    </div>
  )
}

function ChevronButton({
  direction,
  visible,
  onClick,
}: {
  direction: 'back' | 'forward'
  visible: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'forward' ? 'Scroll forward' : 'Scroll back'}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className="hidden md:flex absolute top-1/2 z-20 items-center justify-center transition-all"
      style={{
        [direction === 'forward' ? 'right' : 'left']: -16,
        transform: 'translateY(-50%)',
        width: 40,
        height: 40,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.94)',
        border: '1px solid var(--apple-line)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.08)',
        backdropFilter: 'saturate(180%) blur(10px)',
        WebkitBackdropFilter: 'saturate(180%) blur(10px)',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transitionTimingFunction: 'var(--apple-ease-default)',
        transitionDuration: '200ms',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--apple-text)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === 'forward' ? (
          <path d="M9 6l6 6-6 6" />
        ) : (
          <path d="M15 6l-6 6 6 6" />
        )}
      </svg>
    </button>
  )
}
