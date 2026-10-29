import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        navy: "#07111F",
        primary: "#3188FF",
        cyan: "#46D8FF",
        slate: "#101D2D",
        mist: "#F7FAFF",
      },
      fontFamily: {
        sans: ["var(--font-sora)", "Segoe UI", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "var(--font-sora)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "var(--mx-shadow-float)",
        soft: "var(--mx-shadow-soft)",
      },
      borderRadius: {
        mx: "var(--mx-radius)",
        "mx-lg": "var(--mx-radius-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
