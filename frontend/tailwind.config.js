/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f6fc",
          100: "#e2eaf7",
          500: "#2f5da8",
          600: "#254a86",
          700: "#1c3a68",
        },
      },
    },
  },
  plugins: [],
}
