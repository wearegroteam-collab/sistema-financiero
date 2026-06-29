import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101820",
        muted: "#65717d",
        line: "#d9e0e6",
        panel: "#f7f9fb",
        success: "#178047",
        danger: "#c13d3a",
        info: "#2563eb",
        warning: "#b7791f"
      },
      boxShadow: {
        soft: "0 14px 45px rgba(16, 24, 32, 0.08)"
      }
    },
  },
  plugins: [],
};

export default config;
