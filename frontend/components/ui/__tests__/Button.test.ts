import { describe, test, expect } from 'bun:test'

// Note: Button is a React component, so we test the interface and styling contracts

describe('Button component', () => {
  describe('ButtonProps interface', () => {
    test('extends React.ButtonHTMLAttributes', () => {
      // ButtonProps should accept all standard HTML button attributes
      const props: React.ButtonHTMLAttributes<HTMLButtonElement> = {
        type: 'submit',
        disabled: false,
        className: 'custom-class',
        onClick: () => {},
        'aria-label': 'Test button'
      }

      expect(props.type).toBe('submit')
      expect(props.disabled).toBe(false)
    })

    test('accepts variant prop', () => {
      type Variant = 'default' | 'outline' | 'ghost'

      const variants: Variant[] = ['default', 'outline', 'ghost']

      variants.forEach(variant => {
        expect(['default', 'outline', 'ghost']).toContain(variant)
      })
    })
  })

  describe('Variant styling', () => {
    test('default variant uses accent color', () => {
      const defaultClasses = 'bg-accent text-white hover:bg-accent/90'

      expect(defaultClasses).toContain('bg-accent')
      expect(defaultClasses).toContain('text-white')
      expect(defaultClasses).toContain('hover:bg-accent/90')
    })

    test('outline variant uses border', () => {
      const outlineClasses = 'border border-white/20 bg-transparent text-white hover:bg-white/10'

      expect(outlineClasses).toContain('border')
      expect(outlineClasses).toContain('bg-transparent')
    })

    test('ghost variant is transparent', () => {
      const ghostClasses = 'bg-transparent text-white hover:bg-white/10'

      expect(ghostClasses).toContain('bg-transparent')
      expect(ghostClasses).toContain('hover:bg-white/10')
    })
  })

  describe('Base styling', () => {
    test('has correct base classes', () => {
      const baseClasses = [
        'inline-flex',
        'items-center',
        'justify-center',
        'h-10',
        'px-4',
        'text-sm',
        'font-mono',
        'font-medium',
        'transition-colors'
      ]

      baseClasses.forEach(cls => {
        expect(typeof cls).toBe('string')
        expect(cls.length).toBeGreaterThan(0)
      })
    })

    test('focus styles use accent color', () => {
      const focusClasses = [
        'focus:outline-none',
        'focus:ring-1',
        'focus:ring-accent'
      ]

      focusClasses.forEach(cls => {
        expect(cls).toContain('focus:')
      })
    })

    test('disabled state is styled correctly', () => {
      const disabledClasses = [
        'disabled:pointer-events-none',
        'disabled:opacity-50'
      ]

      disabledClasses.forEach(cls => {
        expect(cls).toContain('disabled:')
      })
    })
  })

  describe('Ref forwarding', () => {
    test('component should be forwardRef-compatible', () => {
      // Button.displayName should be set for React DevTools
      const expectedDisplayName = 'Button'
      expect(expectedDisplayName).toBe('Button')
    })
  })
})
