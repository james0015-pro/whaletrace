/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand green — 買入 / 成長
        green: {
          primary: '#10b981',
          hover: '#059669',
          subtle: 'rgba(16,185,129,0.12)',
        },
        // Alert red — 異常賣出
        red: {
          primary: '#ef4444',
          subtle: 'rgba(239,68,68,0.12)',
        },
        // Signal purple — 群組信號
        signal: {
          DEFAULT: '#8b5cf6',
          light: '#a78bfa',
          subtle: 'rgba(139,92,246,0.12)',
        },
        // Neutral amber — 10b5-1 中性信號
        amber: {
          primary: '#f59e0b',
          subtle: 'rgba(245,158,11,0.12)',
        },
        // Background layers (Linear-inspired dark system)
        canvas: '#08090a',
        surface: '#0f1011',
        elevated: '#191a1b',
        // Text hierarchy
        'text-primary': '#f7f8f8',
        'text-secondary': '#d0d6e0',
        'text-tertiary': '#8a8f98',
        'text-muted': '#62666d',
        // Borders
        'border-default': 'rgba(255,255,255,0.08)',
        'border-subtle': 'rgba(255,255,255,0.05)',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-xl': ['4.5rem', { lineHeight: '1.00', letterSpacing: '-0.022em', fontWeight: '510' }],
        'display': ['3rem', { lineHeight: '1.00', letterSpacing: '-0.022em', fontWeight: '510' }],
        'heading-1': ['2rem', { lineHeight: '1.13', letterSpacing: '-0.022em', fontWeight: '400' }],
        'heading-2': ['1.5rem', { lineHeight: '1.33', letterSpacing: '-0.012em', fontWeight: '400' }],
        'heading-3': ['1.25rem', { lineHeight: '1.33', letterSpacing: '-0.012em', fontWeight: '590' }],
      },
      fontWeight: {
        '510': '510',
      },
      borderRadius: {
        'card': '8px',
        'button': '6px',
        'input': '6px',
      },
      boxShadow: {
        'card': 'rgba(0,0,0,0.2) 0px 0px 0px 1px',
        'elevated': 'rgba(0,0,0,0.4) 0px 2px 4px',
        'modal': '0px 8px 32px rgba(0,0,0,0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease',
        'slide-up': 'slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 150ms ease',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(2px)' },
        },
      },
    },
  },
  plugins: [],
}
