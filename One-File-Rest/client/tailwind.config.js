/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#080808',
        'bg-primary': 'var(--bg-primary, #080808)',
        'bg-secondary': 'var(--bg-secondary, #111)',
        'bg-glass': 'var(--bg-glass, rgba(255,255,255,0.04))',
        'bg-glass-hover': 'var(--bg-glass-hover, rgba(255,255,255,0.07))',
        border: 'var(--border, rgba(255,255,255,0.08))',
        'border-hover': 'var(--border-hover, rgba(255,255,255,0.15))',
        accent: 'var(--accent, #5865F2)',
        'accent-light': 'var(--accent-light, #7289DA)',
        success: 'var(--success, #57F287)',
        warning: 'var(--warning, #FEE75C)',
        danger: 'var(--danger, #ED4245)',
        'text-primary': 'var(--text-primary, #fff)',
        'text-secondary': 'var(--text-secondary, rgba(255,255,255,0.6))',
        'text-muted': 'var(--text-muted, rgba(255,255,255,0.35))',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm, 8px)',
        md: 'var(--radius-md, 12px)',
        lg: 'var(--radius-lg, 16px)',
        xl: 'var(--radius-xl, 24px)',
      },
    },
  },
  plugins: [],
};