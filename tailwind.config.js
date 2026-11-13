/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { 950: '#0d1117', 900: '#131a23', 800: '#1b2430', 700: '#263242' },
        paper: '#f3ead7',
        navi: '#7df9ff',
      },
    },
  },
  plugins: [],
}
