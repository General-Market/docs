/**
 * Centralized chart color tokens.
 * Maps semantic names to the design system values.
 * Use these in Recharts, lightweight-charts, and SVG chart components
 * instead of hard-coded hex values.
 */

export const chartColors = {
  // Semantic
  up: '#16A34A',       // color-up
  down: '#DC2626',     // color-down
  warning: '#D97706',  // color-warning
  info: '#2563EB',     // color-info
  brand: '#00A36C',    // brand

  // Neutrals
  text: '#1A1A1A',     // text-primary
  textSecondary: '#555555', // text-secondary
  textMuted: '#999999', // text-muted
  border: '#E0E0E0',   // border-light
  surface: '#F5F5F5',  // surface
  background: '#FFFFFF', // page

  // Chart-specific
  gridLine: '#F4F4F5',  // muted
  axisLabel: '#999999',  // text-muted
  tooltipBg: '#18181B',  // terminal
  tooltipBorder: 'rgba(255,255,255,0.1)',
  tooltipText: '#FFFFFF',

  // Series palette (for multi-series charts)
  series: [
    '#1A1A1A', '#00A36C', '#2563EB', '#D97706',
    '#7C3AED', '#EC4899', '#14B8A6', '#F59E0B',
    '#3B82F6', '#94A3B8',
  ],
} as const

export const chartTooltipStyle = {
  fontSize: 12,
  borderRadius: 6,
  background: chartColors.tooltipBg,
  border: `1px solid ${chartColors.tooltipBorder}`,
} as const

export const chartLabelStyle = {
  fontSize: 10,
  fill: chartColors.axisLabel,
} as const
