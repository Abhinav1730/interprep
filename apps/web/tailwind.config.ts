import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#FAFAFA",
        panel: "#FFFFFF",
        line: "#E4E4E4",
        mute: "#6B6B6B",
        ink: "#111111",
        accent: {
          DEFAULT: "#29CC57",
          dark: "#22A847",
          light: "#E8F9ED",
        },
        warn: "#B45309",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Source Serif 4", "Georgia", "ui-serif", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,17,17,0.04), 0 8px 24px rgba(17,17,17,0.06)",
        soft: "0 4px 32px rgba(17,17,17,0.08)",
        nav: "0 1px 0 rgba(17,17,17,0.06)",
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
