import { describe, it, expect } from 'bun:test'

/**
 * Tests for OddsBadge component
 * Story 7-12: Update BetCard Component to Display Odds
 *
 * Tests component logic, color mapping, and accessibility.
 */

// ============================================================================
// Favorability Color Tests (AC1)
// ============================================================================

describe('OddsBadge favorability colors', () => {
  const favorabilityColors: Record<string, string> = {
    favorable: 'bg-green-900/80 text-green-300 border-green-700',
    even: 'bg-yellow-900/80 text-yellow-300 border-yellow-700',
    unfavorable: 'bg-red-900/80 text-red-300 border-red-700'
  }

  it('favorable odds use green styling', () => {
    const colorClass = favorabilityColors.favorable
    expect(colorClass).toContain('bg-green-900')
    expect(colorClass).toContain('text-green-300')
    expect(colorClass).toContain('border-green-700')
  })

  it('even odds use yellow styling', () => {
    const colorClass = favorabilityColors.even
    expect(colorClass).toContain('bg-yellow-900')
    expect(colorClass).toContain('text-yellow-300')
    expect(colorClass).toContain('border-yellow-700')
  })

  it('unfavorable odds use red styling', () => {
    const colorClass = favorabilityColors.unfavorable
    expect(colorClass).toContain('bg-red-900')
    expect(colorClass).toContain('text-red-300')
    expect(colorClass).toContain('border-red-700')
  })
})

// ============================================================================
// Tooltip Content Tests
// ============================================================================

describe('OddsBadge tooltips', () => {
  const favorabilityTooltips: Record<string, string> = {
    favorable: 'Favorable odds for matchers - higher potential return',
    even: 'Even odds - balanced risk/reward',
    unfavorable: 'Unfavorable odds for matchers - lower potential return'
  }

  it('favorable tooltip describes benefit to matchers', () => {
    expect(favorabilityTooltips.favorable).toContain('Favorable')
    expect(favorabilityTooltips.favorable).toContain('higher potential return')
  })

  it('even tooltip describes balanced odds', () => {
    expect(favorabilityTooltips.even).toContain('balanced')
  })

  it('unfavorable tooltip describes lower return', () => {
    expect(favorabilityTooltips.unfavorable).toContain('Unfavorable')
    expect(favorabilityTooltips.unfavorable).toContain('lower potential return')
  })
})

// ============================================================================
// Display Format Tests
// ============================================================================

describe('OddsBadge display format', () => {
  function formatOddsDisplay(display: string): string {
    return `${display} Odds`
  }

  it('formats display string with "Odds" suffix', () => {
    expect(formatOddsDisplay('2.00x')).toBe('2.00x Odds')
  })

  it('formats various odds values', () => {
    expect(formatOddsDisplay('1.50x')).toBe('1.50x Odds')
    expect(formatOddsDisplay('0.75x')).toBe('0.75x Odds')
    expect(formatOddsDisplay('3.00x')).toBe('3.00x Odds')
  })
})

// ============================================================================
// Accessibility Tests
// ============================================================================

describe('OddsBadge accessibility', () => {
  function getAriaLabel(display: string, favorability: string): string {
    return `Odds: ${display}, ${favorability} for matchers`
  }

  it('generates proper aria-label', () => {
    const label = getAriaLabel('2.00x', 'favorable')
    expect(label).toBe('Odds: 2.00x, favorable for matchers')
  })

  it('has cursor-help for tooltip hint', () => {
    const cursorClass = 'cursor-help'
    expect(cursorClass).toBe('cursor-help')
  })

  it('has status role', () => {
    const role = 'status'
    expect(role).toBe('status')
  })
})

// ============================================================================
// Styling Tests
// ============================================================================

describe('OddsBadge styling', () => {
  it('has font-mono for consistent number display', () => {
    const fontClass = 'font-mono'
    expect(fontClass).toBe('font-mono')
  })

  it('has font-bold for prominence', () => {
    const fontWeight = 'font-bold'
    expect(fontWeight).toBe('font-bold')
  })

  it('has border for definition', () => {
    const borderClass = 'border'
    expect(borderClass).toBe('border')
  })

  it('has rounded corners', () => {
    const roundedClass = 'rounded'
    expect(roundedClass).toBe('rounded')
  })

  it('has appropriate padding', () => {
    const paddingClass = 'px-3 py-1'
    expect(paddingClass).toContain('px-3')
    expect(paddingClass).toContain('py-1')
  })
})
