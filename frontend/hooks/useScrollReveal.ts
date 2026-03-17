'use client'

import { useEffect } from 'react'

/**
 * Activates scroll reveal for all [data-fade-in] elements in the DOM.
 * CSS transitions in globals.css handle the animation — this hook
 * only adds .is-visible via IntersectionObserver.
 *
 * Call once per page component. No-op when no matching elements exist.
 */
export function useScrollReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll('[data-fade-in]:not(.is-visible)')
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}
