import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' }
    },
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ]
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'enter': {
          from: { opacity: '0', transform: 'translateY(2px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'row-enter': {
          from: { opacity: '0', maxHeight: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', maxHeight: '3rem', transform: 'translateY(0)' }
        },
        'row-exit': {
          from: { opacity: '1', maxHeight: '3rem', transform: 'translateY(0)' },
          to: { opacity: '0', maxHeight: '0', transform: 'translateY(-4px)' }
        },
        'drawer-left-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' }
        },
        'drawer-left-out': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' }
        },
        'drawer-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'drawer-fade-out': { from: { opacity: '1' }, to: { opacity: '0' } }
      },
      animation: {
        'enter': 'enter 160ms cubic-bezier(.2,.7,.2,1) both',
        'row-enter': 'row-enter 180ms cubic-bezier(.2,.7,.2,1) both',
        'row-exit': 'row-exit 180ms cubic-bezier(.4,.2,.8,1) both',
        'drawer-left-in': 'drawer-left-in 320ms cubic-bezier(.32,.72,0,1) both',
        'drawer-left-out': 'drawer-left-out 280ms cubic-bezier(.32,.72,0,1) both',
        'drawer-fade-in': 'drawer-fade-in 220ms ease-out both',
        'drawer-fade-out': 'drawer-fade-out 220ms ease-in both'
      }
    }
  },
  plugins: []
}

export default config
