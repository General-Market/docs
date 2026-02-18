'use client'

import { useState, useId, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: React.ReactNode
  /** Position of tooltip relative to trigger */
  position?: 'top' | 'bottom'
}

/**
 * Reusable Tooltip component with Dev Arena styling
 * Uses portal to escape overflow:hidden containers
 * Black background, white text, monospace font
 * Accessible with proper ARIA attributes
 */
export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const tooltipId = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const tooltipWidth = 200 // Approximate max width

      let left = rect.left + rect.width / 2
      let top = position === 'top' ? rect.top - 8 : rect.bottom + 8

      // Keep tooltip within viewport
      if (left - tooltipWidth / 2 < 10) {
        left = tooltipWidth / 2 + 10
      }
      if (left + tooltipWidth / 2 > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth / 2 - 10
      }

      setTooltipStyle({
        position: 'fixed',
        left: `${left}px`,
        top: position === 'top' ? `${top}px` : `${top}px`,
        transform: position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        zIndex: 9999,
      })
    }
  }, [isVisible, position])

  const tooltipElement = isVisible && mounted ? createPortal(
    <div
      id={tooltipId}
      role="tooltip"
      style={tooltipStyle}
      className="px-3 py-2 bg-black border border-white/20 text-white text-xs font-mono rounded whitespace-nowrap max-w-xs"
    >
      {content}
    </div>,
    document.body
  ) : null

  return (
    <span className="relative inline-block">
      <span
        ref={triggerRef}
        aria-describedby={isVisible ? tooltipId : undefined}
        tabIndex={0}
        className="cursor-help border-b border-dashed border-current"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
      </span>
      {tooltipElement}
    </span>
  )
}
