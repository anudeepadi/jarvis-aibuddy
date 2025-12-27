import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ═══════════════════════════════════════════════════════════════════
      // JARVIS CINEMATIC COLOR PALETTE
      // "Deep Space & Neon" - Premium AI Interface
      // ═══════════════════════════════════════════════════════════════════
      colors: {
        // The Void - Primary dark backgrounds
        void: {
          50: '#0a0a0a',
          100: '#0d0d0d',
          200: '#121212',
          300: '#171717',
          400: '#1a1a1a',
          500: '#1f1f1f',
          600: '#262626',
          700: '#2d2d2d',
          800: '#333333',
          900: '#404040',
        },
        // The Intelligence - Primary accent (Cyan)
        intelligence: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // Secondary accent (Indigo/Purple)
        neural: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Status colors
        status: {
          online: '#22c55e',
          listening: '#3b82f6',
          thinking: '#a855f7',
          speaking: '#06b6d4',
          error: '#ef4444',
          warning: '#f59e0b',
        },
      },

      // ═══════════════════════════════════════════════════════════════════
      // TYPOGRAPHY
      // Geist for UI, JetBrains Mono for code/status
      // ═══════════════════════════════════════════════════════════════════
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'monospace'],
      },

      // ═══════════════════════════════════════════════════════════════════
      // ANIMATIONS
      // Cinematic transitions and effects
      // ═══════════════════════════════════════════════════════════════════
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.4s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'atmosphere': 'atmosphereShift 20s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          from: { opacity: '0', transform: 'translateY(-20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.8', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        atmosphereShift: {
          '0%, 100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05) translateY(-2%)' },
        },
      },

      // ═══════════════════════════════════════════════════════════════════
      // SHADOWS
      // Cinematic depth and glow effects
      // ═══════════════════════════════════════════════════════════════════
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.15)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.3)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
        'cinematic': '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 12px 24px -8px rgba(0, 0, 0, 0.3)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },

      // ═══════════════════════════════════════════════════════════════════
      // BACKDROP BLUR
      // For glassmorphism effects
      // ═══════════════════════════════════════════════════════════════════
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
        '3xl': '60px',
      },

      // ═══════════════════════════════════════════════════════════════════
      // SPACING & SIZING
      // Custom values for the interface
      // ═══════════════════════════════════════════════════════════════════
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      // ═══════════════════════════════════════════════════════════════════
      // BORDER RADIUS
      // ═══════════════════════════════════════════════════════════════════
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
    },
  },
  plugins: [],
}

export default config
