import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff', 100: '#d9ebff', 200: '#bcdcff', 300: '#8ec6ff',
          400: '#59a5ff', 500: '#3382ff', 600: '#1c62f5', 700: '#154de1',
          800: '#1840b6', 900: '#1a3a8f', 950: '#152556',
        },
      },
    },
  },
  plugins: [],
}
export default config
