/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'taxi-yellow': '#facc15',
        'taxi-dark': '#0f172a',
      },
    },
  },
  plugins: [],
}