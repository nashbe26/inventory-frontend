/** @type {import('tailwindcss').Config} */

/**
 * Tailwind reads from the same CSS variables as the hand-written styles
 * (src/styles/tokens.css). `theme.extend` was previously empty, which meant
 * Tailwind utilities used its stock palette while index.css used its own
 * :root values — two disconnected token sets in one app, and the structural
 * reason the interface could not look consistent.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--c-bg)',
        surface: {
          DEFAULT: 'var(--c-surface)',
          sunken: 'var(--c-surface-sunken)',
          hover: 'var(--c-surface-hover)'
        },
        border: {
          DEFAULT: 'var(--c-border)',
          strong: 'var(--c-border-strong)'
        },
        content: {
          DEFAULT: 'var(--c-text)',
          secondary: 'var(--c-text-secondary)',
          muted: 'var(--c-text-muted)',
          inverse: 'var(--c-text-inverse)'
        },
        accent: {
          DEFAULT: 'var(--c-accent)',
          hover: 'var(--c-accent-hover)',
          subtle: 'var(--c-accent-subtle)',
          border: 'var(--c-accent-border)'
        },
        action: {
          DEFAULT: 'var(--c-action)',
          hover: 'var(--c-action-hover)'
        },
        success: {
          DEFAULT: 'var(--c-success)',
          bg: 'var(--c-success-bg)',
          border: 'var(--c-success-border)'
        },
        warning: {
          DEFAULT: 'var(--c-warning)',
          bg: 'var(--c-warning-bg)',
          border: 'var(--c-warning-border)'
        },
        danger: {
          DEFAULT: 'var(--c-danger)',
          bg: 'var(--c-danger-bg)',
          border: 'var(--c-danger-border)'
        },
        info: {
          DEFAULT: 'var(--c-info)',
          bg: 'var(--c-info-bg)',
          border: 'var(--c-info-border)'
        }
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)'
      },
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: '1.4' }],
        sm: ['var(--text-sm)', { lineHeight: '1.45' }],
        base: ['var(--text-base)', { lineHeight: '1.5' }],
        md: ['var(--text-md)', { lineHeight: '1.5' }],
        lg: ['var(--text-lg)', { lineHeight: '1.4' }],
        xl: ['var(--text-xl)', { lineHeight: '1.3' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '1.25' }]
      },
      letterSpacing: {
        tight: 'var(--tracking-tight)',
        tighter: 'var(--tracking-tighter)',
        wide: 'var(--tracking-wide)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)'
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)'
      },
      spacing: {
        sidebar: 'var(--sidebar-width)',
        topbar: 'var(--topbar-height)'
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease)'
      },
      transitionDuration: {
        DEFAULT: 'var(--duration)',
        fast: 'var(--duration-fast)'
      }
    }
  },
  plugins: []
};
