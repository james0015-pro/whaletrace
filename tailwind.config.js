/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Finviz-style color system
        fv: {
          // Backgrounds
          bg: '#ffffff',
          surface: '#f6f8fa',
          elevated: '#edf0f3',
          // Text
          'text-primary': '#1a1d23',
          'text-secondary': '#4a5058',
          'text-tertiary': '#7a8088',
          'text-muted': '#a0a5ab',
          // Data colors
          green: '#00aa44',
          'green-bg': '#e8f5e9',
          red: '#e53935',
          'red-bg': '#ffebee',
          blue: '#1a73e8',
          'blue-bg': '#e3f2fd',
          // Borders
          border: '#e0e3e8',
          'border-light': '#edf0f3',
          // Header
          header: '#1e3a5f',
          'header-text': '#ffffff',
          // Accent
          accent: '#ff6d00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'table-sm': ['11px', { lineHeight: '16px' }],
        'table': ['12px', { lineHeight: '18px' }],
        'table-lg': ['13px', { lineHeight: '20px' }],
      },
      borderRadius: {
        'fv': '3px',
      },
      boxShadow: {
        'fv-card': '0 1px 3px rgba(0,0,0,0.08)',
        'fv-dropdown': '0 4px 16px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
