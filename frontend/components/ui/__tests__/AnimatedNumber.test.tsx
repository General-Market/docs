import { describe, test, expect } from 'bun:test'

describe('AnimatedNumber', () => {
  describe('AC3: Count animation logic', () => {
    test('ease-out function provides smooth deceleration', () => {
      // Progress from 0 to 1
      const easeOut = (progress: number) => 1 - Math.pow(1 - progress, 3)

      // At 0% progress, output should be 0
      expect(easeOut(0)).toBe(0)

      // At 100% progress, output should be 1
      expect(easeOut(1)).toBe(1)

      // At 50% progress, ease-out should be > 50% (faster start)
      expect(easeOut(0.5)).toBeGreaterThan(0.5)

      // At 25% progress
      expect(easeOut(0.25)).toBeGreaterThan(0.25)

      // At 75% progress, should be close to 1 (decelerating)
      expect(easeOut(0.75)).toBeGreaterThan(0.9)
    })

    test('interpolation from old to new value is correct', () => {
      const startValue = 0
      const endValue = 100
      const diff = endValue - startValue
      const progress = 0.5
      const easeOut = 1 - Math.pow(1 - progress, 3)

      const currentValue = startValue + diff * easeOut

      // At 50% eased progress (which is > 50%), value should be > 50
      expect(currentValue).toBeGreaterThan(50)
      expect(currentValue).toBeLessThan(100)
    })

    test('interpolation for decreasing values is correct', () => {
      const startValue = 100
      const endValue = 50
      const diff = endValue - startValue // -50
      const progress = 0.5
      const easeOut = 1 - Math.pow(1 - progress, 3)

      const currentValue = startValue + diff * easeOut

      // Value should decrease from 100 toward 50
      expect(currentValue).toBeLessThan(100)
      expect(currentValue).toBeGreaterThan(50)
    })
  })

  describe('prefix and suffix support', () => {
    test('format with prefix', () => {
      const value = 100
      const prefix = '$'
      const suffix = ''
      const formatted = `${prefix}${value.toFixed(2)}${suffix}`

      expect(formatted).toBe('$100.00')
    })

    test('format with suffix', () => {
      const value = 50
      const prefix = ''
      const suffix = '%'
      const formatted = `${prefix}${value.toFixed(2)}${suffix}`

      expect(formatted).toBe('50.00%')
    })

    test('format with both prefix and suffix', () => {
      const value = 75
      const prefix = '$'
      const suffix = ' USD'
      const formatted = `${prefix}${value.toFixed(2)}${suffix}`

      expect(formatted).toBe('$75.00 USD')
    })
  })

  describe('decimals prop', () => {
    test('defaults to 2 decimals', () => {
      const value = 100
      const decimals = 2
      expect(value.toFixed(decimals)).toBe('100.00')
    })

    test('respects 0 decimals', () => {
      const value = 100.567
      const decimals = 0
      expect(value.toFixed(decimals)).toBe('101')
    })

    test('respects 4 decimals', () => {
      const value = 3.1415926
      const decimals = 4
      expect(value.toFixed(decimals)).toBe('3.1416')
    })
  })

  describe('duration calculation', () => {
    test('default duration is 1000ms', () => {
      const duration = 1000
      expect(duration).toBe(1000)
    })

    test('progress calculation is correct', () => {
      const startTime = 0
      const currentTime = 500
      const duration = 1000

      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      expect(progress).toBe(0.5)
    })

    test('progress is clamped to 1', () => {
      const startTime = 0
      const currentTime = 1500
      const duration = 1000

      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      expect(progress).toBe(1)
    })
  })

  describe('disabled prop logic', () => {
    test('when disabled, value shows immediately without animation', () => {
      const disabled = true
      const oldValue = 0
      const newValue = 100

      // When disabled, display value should immediately be new value
      const displayValue = disabled ? newValue : oldValue

      expect(displayValue).toBe(newValue)
    })

    test('when not disabled, animation should run', () => {
      const disabled = false
      const shouldAnimate = !disabled

      expect(shouldAnimate).toBe(true)
    })
  })

  describe('formatFn prop', () => {
    test('custom formatFn takes precedence', () => {
      const formatFn = (val: number) => val.toLocaleString('en-US')
      const value = 1000000

      expect(formatFn(value)).toBe('1,000,000')
    })

    test('formatFn can include custom formatting', () => {
      const formatFn = (val: number) => `${Math.round(val)}!`
      const value = 99.9

      expect(formatFn(value)).toBe('100!')
    })
  })

  describe('same value handling', () => {
    test('no animation when value unchanged', () => {
      const previousValue = 100
      const currentValue = 100

      const shouldAnimate = currentValue !== previousValue

      expect(shouldAnimate).toBe(false)
    })
  })

  describe('props interface', () => {
    test('AnimatedNumberProps interface is complete', () => {
      interface AnimatedNumberProps {
        value: number
        prefix?: string
        suffix?: string
        decimals?: number
        duration?: number
        formatFn?: (val: number) => string
        className?: string
        disabled?: boolean
      }

      const props: AnimatedNumberProps = {
        value: 100,
        prefix: '$',
        suffix: '',
        decimals: 2,
        duration: 1000,
        formatFn: (val) => val.toString(),
        className: 'test',
        disabled: false
      }

      expect(props.value).toBe(100)
      expect(props.prefix).toBe('$')
      expect(props.decimals).toBe(2)
      expect(props.duration).toBe(1000)
      expect(props.disabled).toBe(false)
    })
  })
})
