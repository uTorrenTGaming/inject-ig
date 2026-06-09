/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        surface: "#09090b",
        primary: "#fafafa",
        muted: "#a1a1aa",
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
