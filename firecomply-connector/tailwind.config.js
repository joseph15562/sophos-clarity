/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
