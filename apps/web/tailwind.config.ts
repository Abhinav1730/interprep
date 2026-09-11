import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0B0C0E",
        panel: "#141518",
        line: "#23252B",
        mute: "#8B909A",
        ink: "#F4F5F7",
        accent: "#5EEAD4",
        warn: "#F5C16C",
        danger: "#F87171",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 0 0 1px rgba(255,255,255,0.04), 0 20px 50px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
