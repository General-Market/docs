/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: '#09090B',
        card: { DEFAULT: '#FFFFFF', hover: '#FAFAFA' },
        muted: '#F4F4F5',
        'text-primary': '#18181B',
        'text-secondary': '#52525B',
        'text-muted': '#A1A1AA',
        'text-inverse': '#FAFAFA',
        'text-inverse-muted': '#71717A',
        'border-light': '#E4E4E7',
        'border-medium': '#D4D4D8',
        'border-dark': '#3F3F46',
        'color-up': '#16A34A',
        'color-down': '#DC2626',
        'color-warning': '#D97706',
        'color-info': '#2563EB',
        'surface-up': '#F0FDF4',
        'surface-down': '#FEF2F2',
        'surface-warning': '#FFFBEB',
        'surface-info': '#EFF6FF',
        'surface-dark': '#09090B',
        // Keep old tokens as aliases for transition period (components still reference them)
        terminal: '#09090B',
        accent: '#18181B',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      maxWidth: {
        site: '1200px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
        modal: '0 25px 50px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}
