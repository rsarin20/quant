import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0e1116",
        panel: "#151a22",
        panel2: "#1b212b",
        line: "#252c38",
        muted: "#8b95a7",
        accent: "#5b8cff",
        good: "#3ecf8e",
        warn: "#f0a13a",
        bad: "#f16a6a",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
