/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#E1F5EE',
          100: '#C3EBDD',
          500: '#1D9E75',
          600: '#0F6E56',
          700: '#085041',
        },
      },
      fontFamily: {
        sans: ['Sarabun', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}