import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

// Os tokens de cor/raio/fonte apontam direto pras custom properties já
// definidas em src/index.css — nenhuma cor nova aqui, só uma ponte pro
// Tailwind conseguir gerar utilitários (bg-primary, text-success, etc.)
// a partir da MESMA fonte de verdade que o CSS legado já usa.
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          light: 'var(--primary-light)',
          foreground: '#ffffff',
        },
        'brand-teal': 'var(--brand-teal)',
        'brand-graphite': 'var(--brand-graphite)',
        success: { DEFAULT: 'var(--success)', light: 'var(--success-light)', border: 'var(--success-border)' },
        danger:  { DEFAULT: 'var(--danger)',  light: 'var(--danger-light)',  border: 'var(--danger-border)' },
        warning: { DEFAULT: 'var(--warning)', light: 'var(--warning-light)', border: 'var(--warning-border)' },
        background: 'var(--background)',
        surface: { DEFAULT: 'var(--surface)', hover: 'var(--surface-hover)' },
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        foreground: 'var(--text-main)',
        muted: { DEFAULT: 'var(--text-muted)', foreground: 'var(--text-subtle)' },
        subtle: 'var(--text-subtle)',
        ring: 'var(--primary)',
        input: 'var(--border)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      fontFamily: {
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
