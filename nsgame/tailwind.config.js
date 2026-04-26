/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light theme — institutional BlackRock
        page: '#FFFFFF',
        surface: '#F5F5F5',
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
      fontFamily: {
        // IBM Plex Sans — institutional UI body. Distinct from Geist/Inter,
        // carries research-org gravity without reading as nostalgic.
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'sans-serif'],
        // Fraunces — variable editorial serif for display headlines, hero
        // mastheads, and any moment that earns Bloomberg/FT energy.
        display: ['var(--font-display)', 'Georgia', 'Times New Roman', 'serif'],
        // IBM Plex Mono — tabular data, KPIs, code. Family-matched to Plex Sans.
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'micro':   ['0.625rem',  { lineHeight: '1.4' }],                           // 10px — mobile nav, tiny badges
        'label':   ['0.6875rem', { lineHeight: '1.4' }],                           // 11px — uppercase labels, table headers
        'caption': ['0.75rem',   { lineHeight: '1.5' }],                           // 12px — secondary info, timestamps
        'body-sm': ['0.8125rem', { lineHeight: '1.55' }],                          // 13px — compact body, sidebar items
        'body':    ['0.875rem',  { lineHeight: '1.6' }],                           // 14px — default body text
        'base':    ['1rem',      { lineHeight: '1.6' }],                           // 16px — readable prose
        'title':   ['1.25rem',   { lineHeight: '1.3', letterSpacing: '-0.02em' }], // 20px — card titles, stat values
        'stat':    ['2rem',      { lineHeight: '1.15', letterSpacing: '-0.03em' }],// 32px — hero numbers, KPIs
        'heading': ['1.75rem',   { lineHeight: '1.2', letterSpacing: '-0.025em' }],// 28px — section headings
        'display': ['clamp(2.25rem, 5vw, 3.5rem)', { lineHeight: '1.05', letterSpacing: '-0.035em' }], // 36–56px fluid — hero
      },
      maxWidth: {
        site: 'none',
        'site-wide': 'none',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.06)',
        'card-elevated': '0 2px 6px rgba(0,0,0,0.04)',
        modal: '0 25px 50px rgba(0,0,0,0.20)',
      },
      borderRadius: {
        card: '6px',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '40%, 100%': { transform: 'translateX(150%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s ease infinite',
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '120': '120ms',
        '220': '220ms',
      },
    },
  },
  plugins: [
    // Hide scrollbar but keep scroll functionality
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      })
    },
  ],
}
