/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#4f6ef7", dark: "#3b5de7", light: "#6b8aff", 50: "#eef1ff" },
        accent: { DEFAULT: "#8b5cf6", light: "#a78bfa" },
        "background-light": "#f0f2f5",
        "background-dark": "#0c111d",
        "surface-light": "#f8f9fb",
        "surface-dark": "#151c2c",
        "surface-lighter": "#1e2842",
        "border-dark": "#1e293b",
        "border-light": "#e2e8f0",
        "card-dark": "#171f30",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.08)",
        glow: "0 0 24px -4px rgb(79 110 247 / 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.25s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
