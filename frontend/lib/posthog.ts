import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window === 'undefined') return
  if (posthog.__loaded) return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    ui_host: 'https://us.posthog.com',

    // ── Autocapture & pageviews ──
    autocapture: true,
    capture_pageview: false,  // manual via App Router hook
    capture_pageleave: true,
    person_profiles: 'identified_only',

    // ── Session replay ──
    session_recording: {
      maskAllInputs: false,
      maskTextSelector: '[data-ph-mask]',
      recordCrossOriginIframes: true,
    },

    // ── Heatmaps ──
    enable_heatmaps: true,

    // ── Error tracking ──
    capture_exceptions: true,

    // ── Scroll depth ──
    scroll_root_selector: ['#main-content', 'main'],

    // ── Performance ──
    persistence: 'localStorage+cookie',
  })
}

export { posthog }
