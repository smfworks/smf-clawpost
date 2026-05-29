/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--clawpost-bg)",
        panel: "var(--clawpost-panel)",
        accent: "var(--clawpost-accent)",
        ink: "var(--clawpost-ink)",
        muted: "var(--clawpost-muted)",
      },
    },
  },
  plugins: [],
};
