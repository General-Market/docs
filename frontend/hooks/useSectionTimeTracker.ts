'use client'

import { useEffect, useRef } from 'react'
import { posthog } from '@/lib/posthog'

export function useSectionTimeTracker(sectionIds: string[]) {
  const enterTimes = useRef<Map<string, number>>(new Map())
  const interacted = useRef<Set<string>>(new Set())

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      for (const id of sectionIds) {
        const section = document.getElementById(id)
        if (section?.contains(target)) {
          interacted.current.add(id)
          break
        }
      }
    }
    document.addEventListener('click', handleClick, true)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting) {
            enterTimes.current.set(id, Date.now())
          } else if (enterTimes.current.has(id)) {
            const enterTime = enterTimes.current.get(id)!
            const timeSpent = (Date.now() - enterTime) / 1000
            if (timeSpent > 1) {
              posthog.capture('section_time_spent', {
                section_name: id,
                time_spent_seconds: Math.round(timeSpent),
                had_interaction: interacted.current.has(id),
              })
            }
            enterTimes.current.delete(id)
            interacted.current.delete(id)
          }
        }
      },
      { threshold: 0.3 }
    )

    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
      for (const [id, enterTime] of enterTimes.current.entries()) {
        const timeSpent = (Date.now() - enterTime) / 1000
        if (timeSpent > 1) {
          posthog.capture('section_time_spent', {
            section_name: id,
            time_spent_seconds: Math.round(timeSpent),
            had_interaction: interacted.current.has(id),
          })
        }
      }
    }
  }, [sectionIds])
}
