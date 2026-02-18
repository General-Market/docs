import { describe, it, expect } from 'bun:test'
import { formatRelativeTime } from '../time'

describe('formatRelativeTime', () => {
  it('returns "just now" for times less than 1 minute ago', () => {
    const now = Date.now()
    const thirtySecondsAgo = new Date(now - 30 * 1000).toISOString()
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now')
  })

  it('returns minutes ago for times between 1-59 minutes', () => {
    const now = Date.now()
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString()
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago')

    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString()
    expect(formatRelativeTime(thirtyMinutesAgo)).toBe('30m ago')
  })

  it('returns hours ago for times between 1-23 hours', () => {
    const now = Date.now()
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')

    const twentyHoursAgo = new Date(now - 20 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(twentyHoursAgo)).toBe('20h ago')
  })

  it('returns days ago for times between 1-6 days', () => {
    const now = Date.now()
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')

    const sixDaysAgo = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(sixDaysAgo)).toBe('6d ago')
  })

  it('returns locale date string for times 7+ days ago', () => {
    const now = Date.now()
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString()
    // Should return formatted date, not "Xd ago"
    const result = formatRelativeTime(tenDaysAgo)
    expect(result).not.toContain('ago')
  })

  it('returns "-" for empty string input', () => {
    expect(formatRelativeTime('')).toBe('-')
  })

  it('returns "-" for invalid date string', () => {
    expect(formatRelativeTime('not-a-date')).toBe('-')
    expect(formatRelativeTime('invalid')).toBe('-')
  })
})
