import type { Config } from "tailwindcss";

const config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dular: {
          green: "#3DC87A",
          "green-dark": "#2DB368",
          "green-deep": "#1B7A4A",
          "green-light": "#EDF7F2",
          teal: "#3A9E8E",
          ink: "#1B2D22",
          sub: "#90A89B",
          stroke: "#E6EDEA",
          bg: "#EEF5F1",
          card: "#FFFFFF",
          star: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,0.07)",
        float: "0 4px 18px rgba(47,142,126,0.4)",
        tabbar: "0 4px 22px rgba(0,0,0,0.11)",
      },
      borderRadius: {
        "13": "13px",
        "16": "16px",
        "22": "22px",
        "36": "36px",
        "46": "46px",
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
