import { describe, test, expect } from 'bun:test'
import { cn } from '@/lib/utils/cn'

describe('cn utility', () => {
  describe('Basic class merging', () => {
    test('merges multiple class strings', () => {
      const result = cn('class1', 'class2', 'class3')
      expect(result).toBe('class1 class2 class3')
    })

    test('handles single class', () => {
      const result = cn('single-class')
      expect(result).toBe('single-class')
    })

    test('handles empty call', () => {
      const result = cn()
      expect(result).toBe('')
    })
  })

  describe('Falsy value filtering', () => {
    test('filters out undefined values', () => {
      const result = cn('class1', undefined, 'class2')
      expect(result).toBe('class1 class2')
    })

    test('filters out null values', () => {
      const result = cn('class1', null, 'class2')
      expect(result).toBe('class1 class2')
    })

    test('filters out false values', () => {
      const result = cn('class1', false, 'class2')
      expect(result).toBe('class1 class2')
    })

    test('filters out empty strings', () => {
      const result = cn('class1', '', 'class2')
      expect(result).toBe('class1 class2')
    })

    test('handles all falsy values at once', () => {
      const result = cn('class1', undefined, null, false, '', 'class2')
      expect(result).toBe('class1 class2')
    })
  })

  describe('Conditional class usage', () => {
    test('includes class when condition is true', () => {
      const isHighlighted = true
      const result = cn('base-class', isHighlighted && 'highlight-class')
      expect(result).toBe('base-class highlight-class')
    })

    test('excludes class when condition is false', () => {
      const isHighlighted = false
      const result = cn('base-class', isHighlighted && 'highlight-class')
      expect(result).toBe('base-class')
    })

    test('handles multiple conditions', () => {
      const isActive = true
      const isDisabled = false
      const isLoading = true
      const result = cn(
        'base',
        isActive && 'active',
        isDisabled && 'disabled',
        isLoading && 'loading'
      )
      expect(result).toBe('base active loading')
    })
  })

  describe('Real-world component patterns', () => {
    test('Input component pattern', () => {
      const className = 'custom-input'
      const result = cn(
        'flex h-10 w-full rounded-none border border-white/20 bg-terminal px-3 py-2',
        'text-sm text-white font-mono placeholder:text-white/40',
        'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )
      expect(result).toContain('custom-input')
      expect(result).toContain('flex h-10')
      expect(result).toContain('focus:ring-accent')
    })

    test('Input component without custom className', () => {
      const className = undefined
      const result = cn(
        'flex h-10 w-full',
        className
      )
      expect(result).toBe('flex h-10 w-full')
      expect(result).not.toContain('undefined')
    })

    test('Button variant pattern', () => {
      const variant = 'outline'
      const variantClasses = {
        default: 'bg-accent text-white',
        outline: 'border border-white/20 bg-transparent',
        ghost: 'bg-transparent hover:bg-white/10'
      }
      const result = cn(
        'inline-flex items-center',
        variantClasses[variant as keyof typeof variantClasses]
      )
      expect(result).toBe('inline-flex items-center border border-white/20 bg-transparent')
    })
  })
})
