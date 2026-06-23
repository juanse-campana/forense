import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f1418",
        foreground: "#dee3e8",
        surface: {
          DEFAULT: "#1b2024",
          dim: "#0f1418",
          bright: "#343a3e",
          lowest: "#0a0f12",
          low: "#171c20",
          high: "#252b2e",
          highest: "#303539",
          variant: "#303539",
        },
        primary: {
          DEFAULT: "#8ed5ff",
          container: "#38bdf8",
          fixed: "#c4e7ff",
          "fixed-dim": "#7bd0ff",
        },
        secondary: {
          DEFAULT: "#4edea3",
          container: "#00a572",
          fixed: "#6ffbbe",
          "fixed-dim": "#4edea3",
        },
        tertiary: {
          DEFAULT: "#ffc176",
          container: "#f1a02b",
          fixed: "#ffddb8",
          "fixed-dim": "#ffb960",
        },
        error: {
          DEFAULT: "#EF4444",
          container: "#93000a",
        },
        warning: "#F59E0B",
        safe: "#10B981",
        outline: {
          DEFAULT: "#87929a",
          variant: "#3e484f",
        },
        "on-surface": "#dee3e8",
        "on-surface-variant": "#bdc8d1",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "7": "28px",
        "8": "32px",
        "9": "36px",
        "10": "40px",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
