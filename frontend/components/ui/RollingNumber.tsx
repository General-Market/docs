'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface RollingNumberProps {
  value: number
  format: (n: number) => string
  className?: string
  fromValue?: number
  animateOnView?: boolean
  duration?: number
}

export function RollingNumber({
  value,
  format,
  className,
  fromValue = 0,
  animateOnView = true,
  duration = 1.6,
}: RollingNumberProps) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [displayValue, setDisplayValue] = useState(animateOnView ? fromValue : value)
  const [revealed, setRevealed] = useState(!animateOnView)

  useEffect(() => {
    if (!animateOnView || revealed || !ref.current) return
    if (reduced) {
      setDisplayValue(value)
      setRevealed(true)
      return
    }
    const node = ref.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setDisplayValue(value)
            setRevealed(true)
            observer.disconnect()
            return
          }
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [animateOnView, revealed, value, reduced])

  useEffect(() => {
    if (revealed) setDisplayValue(value)
  }, [value, revealed])

  if (reduced) {
    return <span className={className}>{format(value)}</span>
  }

  const formatted = format(displayValue)
  const chars = formatted.split('')

  return (
    <span ref={ref} className={`inline-flex items-baseline tabular-nums ${className ?? ''}`}>
      {chars.map((c, i) => {
        if (/\d/.test(c)) {
          return <RollingDigit key={`d-${i}-${chars.length}`} digit={parseInt(c, 10)} duration={duration} />
        }
        return (
          <span key={`s-${i}-${chars.length}`} className="inline-block">
            {c}
          </span>
        )
      })}
    </span>
  )
}

function RollingDigit({ digit, duration }: { digit: number; duration: number }) {
  const [blur, setBlur] = useState(false)
  const prev = useRef(digit)

  useEffect(() => {
    if (prev.current === digit) return
    setBlur(true)
    const t = setTimeout(() => setBlur(false), duration * 1000 * 0.7)
    prev.current = digit
    return () => clearTimeout(t)
  }, [digit, duration])

  return (
    <span
      className="relative inline-block overflow-hidden align-baseline"
      style={{
        height: '1em',
        lineHeight: 1,
        filter: blur ? 'blur(1.4px)' : 'none',
        transition: 'filter 240ms ease',
      }}
    >
      <span className="invisible block" aria-hidden="true">
        0
      </span>
      <motion.span
        className="absolute left-0 top-0 flex flex-col leading-none will-change-transform"
        animate={{ y: `-${digit}em` }}
        transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} style={{ height: '1em', lineHeight: 1 }} className="block">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}
