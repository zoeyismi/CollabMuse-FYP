/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#fdfcfc",
        cream: "#f5f3f1",
        stone: "#ebe8e4",
        smoke: "#777169",
        "ink-700": "#44403b",
        "ink-600": "#59544f",
        "ink-400": "#a59f97",
        human: { DEFAULT: "#235fba", ink: "#174a78", wash: "#e9eff8" },
        copilot: { DEFAULT: "#ff4704", ink: "#a33a0c", wash: "#fff0e8" },
        // Legacy names, remapped onto the studio palette.
        ink: "#000000",
        mist: "#f5f3f1",
        graphite: "#44403b",
        sage: "#a59f97",
        brass: "#ff4704",
        clay: "#a33a0c",
      },
      boxShadow: {
        ring: "rgba(0,0,0,0.125) 0 0 0 0.5px, rgba(0,0,0,0.04) 0 1px 1px, rgba(0,0,0,0.04) 0 2px 4px",
        glass: "rgba(0,0,0,0.125) 0 0 0 0.5px, rgba(0,0,0,0.04) 0 1px 1px, rgba(0,0,0,0.04) 0 2px 4px",
        glow: "none",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Inter Tight", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "Geist Mono", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        studio: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
