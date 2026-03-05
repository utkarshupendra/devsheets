/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ds: {
          bg: 'rgb(var(--ds-bg) / <alpha-value>)',
          surface: 'rgb(var(--ds-surface) / <alpha-value>)',
          surface2: 'rgb(var(--ds-surface2) / <alpha-value>)',
          border: 'rgb(var(--ds-border) / <alpha-value>)',
          text: 'rgb(var(--ds-text) / <alpha-value>)',
          textMuted: 'rgb(var(--ds-textMuted) / <alpha-value>)',
          accent: 'rgb(var(--ds-accent) / <alpha-value>)',
          accentHover: 'rgb(var(--ds-accentHover) / <alpha-value>)',
          green: 'rgb(var(--ds-green) / <alpha-value>)',
          red: 'rgb(var(--ds-red) / <alpha-value>)',
          orange: 'rgb(var(--ds-orange) / <alpha-value>)',
          purple: 'rgb(var(--ds-purple) / <alpha-value>)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        sans: ['Inter', 'SF Pro', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
