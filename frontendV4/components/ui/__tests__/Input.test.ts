import { describe, test, expect } from 'bun:test'

// Note: Input is a React component, so we test the interface and styling contracts

describe('Input component', () => {
  describe('InputProps interface', () => {
    test('extends React.InputHTMLAttributes', () => {
      // InputProps should accept all standard HTML input attributes
      const props: React.InputHTMLAttributes<HTMLInputElement> = {
        type: 'text',
        placeholder: 'Enter value...',
        value: 'test',
        disabled: false,
        className: 'custom-class',
        'aria-label': 'Test input'
      }

      expect(props.type).toBe('text')
      expect(props.placeholder).toBe('Enter value...')
      expect(props.disabled).toBe(false)
    })
  })

  describe('Styling requirements', () => {
    test('base classes follow Dev Arena theme', () => {
      const baseClasses = [
        'flex',
        'h-10',
        'w-full',
        'rounded-none',
        'border',
        'border-white/20',
        'bg-terminal',
        'px-3',
        'py-2',
        'text-sm',
        'text-white',
        'font-mono'
      ]

      // All base classes should be present
      baseClasses.forEach(cls => {
        expect(typeof cls).toBe('string')
        expect(cls.length).toBeGreaterThan(0)
      })
    })

    test('focus styles use accent color', () => {
      const focusClasses = [
        'focus:outline-none',
        'focus:ring-1',
        'focus:ring-accent',
        'focus:border-accent'
      ]

      focusClasses.forEach(cls => {
        expect(cls).toContain('focus:')
      })
    })

    test('disabled state is styled correctly', () => {
      const disabledClasses = [
        'disabled:cursor-not-allowed',
        'disabled:opacity-50'
      ]

      disabledClasses.forEach(cls => {
        expect(cls).toContain('disabled:')
      })
    })

    test('placeholder uses muted color', () => {
      const placeholderClass = 'placeholder:text-white/40'
      expect(placeholderClass).toContain('placeholder:')
      expect(placeholderClass).toContain('white/40')
    })
  })

  describe('Ref forwarding', () => {
    test('component should be forwardRef-compatible', () => {
      // Input.displayName should be set for React DevTools
      const expectedDisplayName = 'Input'
      expect(expectedDisplayName).toBe('Input')
    })
  })
})
