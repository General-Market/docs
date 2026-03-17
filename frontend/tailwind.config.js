/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      spacing: {
        'section': '3.5rem',     // 56px — between major page sections
        'section-lg': '5rem',    // 80px — hero/primary section padding
        'section-xl': '7rem',    // 112px — page-level breathing room
        'section-2xl': '10rem',  // 160px — dramatic page breaks
        'block': '2rem',         // 32px — between content blocks within a section
        'block-sm': '1.5rem',    // 24px — tighter block spacing
        'element': '1rem',       // 16px — between related elements
        'element-sm': '0.5rem',  // 8px — tight element spacing
        'element-xs': '0.25rem', // 4px — minimal spacing (inline)
      },
      colors: {
        // Light theme — institutional BlackRock
        page: '#FFFFFF',
        surface: '#F4F6F5',
        card: { DEFAULT: '#FFFFFF', hover: '#FAFAFA' },
        muted: '#F4F4F5',
        'text-primary': '#1A1A1A',
        'text-secondary': '#555555',
        'text-muted': '#999999',
        'text-inverse': '#FFFFFF',
        'text-inverse-muted': '#D4D4D8',
        'border-light': '#E0E0E0',
        'border-medium': '#D4D4D8',
        'border-dark': '#A1A1AA',
        'border-strong': '#000000',
        'color-up': '#16A34A',
        'color-down': '#DC2626',
        'color-warning': '#D97706',
        'color-info': '#2563EB',
        'surface-up': '#F0FDF4',
        'surface-down': '#FEF2F2',
        'surface-warning': '#FFFBEB',
        'surface-info': '#EFF6FF',
        'surface-dark': '#18181B',
        // Institutional green accent (BlackRock-inspired)
        brand: { DEFAULT: '#00A36C', light: '#E6F7F0', dark: '#008A5A' },
        // Aliases — terminal dark theme for Markets / ITP cards
        terminal: { DEFAULT: '#18181B', dark: '#0C0C0D' },
        accent: '#C40000',
      },
      fontSize: {
        'micro':   ['0.625rem',  { lineHeight: '1.4' }],   // 10px — footnotes, timestamps, micro-data
        'label':   ['0.6875rem', { lineHeight: '1.4' }],   // 11px — table headers, badges, uppercase labels
        'caption': ['0.75rem',   { lineHeight: '1.5' }],   // 12px — nav items, metadata, secondary info
        'body':    ['0.875rem',  { lineHeight: '1.6' }],   // 14px — body copy, descriptions, inputs
        'subhead': ['1rem',      { lineHeight: '1.4' }],   // 16px — card headings, prominent body
        'heading': ['1.25rem',   { lineHeight: '1.3' }],   // 20px — stat values, section headings
        'title':   ['1.375rem',  { lineHeight: '1.2' }],   // 22px — section titles, modal titles
        'display': ['2.75rem',   { lineHeight: '1.08', letterSpacing: '-0.025em' }],  // 44px — page titles (was 32)
        'hero':    ['3.5rem',    { lineHeight: '1.02', letterSpacing: '-0.035em' }],  // 56px — hero headlines
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      maxWidth: {
        site: '1280px',
        'site-wide': '1400px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.10)',
        'card-elevated': '0 4px 12px rgba(0,0,0,0.08)',
        modal: '0 25px 60px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        card: '6px',
      },
    },
  },
  plugins: [],
}
