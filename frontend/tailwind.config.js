/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        card: "var(--card)",
        card2: "var(--card2)",
        accent: "var(--accent)",
        accent2: "var(--accent2)",
        ink: "var(--text)",
        inkSoft: "var(--text-soft)",
        edge: "var(--border)",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      keyframes: {
        levitate: {
          "0%, 100%": { transform: "translateY(0px) rotate(-0.4deg)" },
          "50%": { transform: "translateY(-8px) rotate(0.4deg)" },
        },
        floatIn: {
          "0%": { opacity: "0", transform: "translateX(-24px) translateY(10px) scale(0.9)" },
          "100%": { opacity: "1", transform: "translateX(0) translateY(0) scale(1)" },
        },
        popCheck: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        levitate: "levitate 4.5s ease-in-out infinite",
        floatIn: "floatIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        popCheck: "popCheck 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
