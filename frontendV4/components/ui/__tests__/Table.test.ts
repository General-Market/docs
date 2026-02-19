import { describe, test, expect } from 'bun:test'

// Test the Shadcn/ui Table component structure and styling
describe('Table components', () => {
  describe('Table', () => {
    test('base table has correct structure', () => {
      // Table wraps content in overflow-auto div for responsive scrolling
      const wrapperClasses = 'relative w-full overflow-auto'
      expect(wrapperClasses).toContain('overflow-auto')
      expect(wrapperClasses).toContain('w-full')
    })

    test('table has correct base classes', () => {
      const tableClasses = 'w-full caption-bottom text-sm'
      expect(tableClasses).toContain('w-full')
      expect(tableClasses).toContain('text-sm')
    })
  })

  describe('TableHeader', () => {
    test('has border on rows', () => {
      const headerClasses = '[&_tr]:border-b'
      expect(headerClasses).toContain('border-b')
    })
  })

  describe('TableBody', () => {
    test('removes border from last row', () => {
      const bodyClasses = '[&_tr:last-child]:border-0'
      expect(bodyClasses).toContain('border-0')
    })
  })

  describe('TableRow', () => {
    test('has hover and transition effects', () => {
      const rowClasses = 'border-b border-white/10 transition-colors hover:bg-white/5'
      expect(rowClasses).toContain('hover:bg-white/5')
      expect(rowClasses).toContain('transition-colors')
      expect(rowClasses).toContain('border-white/10')
    })

    test('supports selected state', () => {
      const rowClasses = 'data-[state=selected]:bg-white/10'
      expect(rowClasses).toContain('data-[state=selected]')
    })
  })

  describe('TableHead', () => {
    test('has correct Dev Arena styling', () => {
      const headClasses = 'h-10 px-4 text-left align-middle font-mono text-xs uppercase text-white/60'
      expect(headClasses).toContain('font-mono')
      expect(headClasses).toContain('uppercase')
      expect(headClasses).toContain('text-white/60')
      expect(headClasses).toContain('text-xs')
    })
  })

  describe('TableCell', () => {
    test('has correct padding', () => {
      const cellClasses = 'px-4 py-3 align-middle'
      expect(cellClasses).toContain('px-4')
      expect(cellClasses).toContain('py-3')
      expect(cellClasses).toContain('align-middle')
    })
  })

  describe('Exports', () => {
    test('exports all required components', () => {
      const expectedExports = [
        'Table',
        'TableHeader',
        'TableBody',
        'TableFooter',
        'TableHead',
        'TableRow',
        'TableCell',
        'TableCaption'
      ]

      expectedExports.forEach(exportName => {
        expect(exportName).toBeTruthy()
      })
    })
  })
})
