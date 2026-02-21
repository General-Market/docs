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
        // Aliases
        terminal: '#18181B',
        accent: '#18181B',
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
        card: '0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.06)',
        'card-elevated': '0 2px 6px rgba(0,0,0,0.04)',
        modal: '0 25px 50px rgba(0,0,0,0.20)',
      },
      borderRadius: {
        card: '6px',
      },
    },
  },
  plugins: [],
}
