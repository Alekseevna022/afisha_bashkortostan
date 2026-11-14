import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Теплый "бумажный" фон вместо стерильного белого
        background: "#F9F7F2",
        surface: "#FFFFFF",
        // Глубокий графитовый вместо #000000
        primary: "#1C1917",
        // Терракотовый/медовый акцент (локальный колорит)
        accent: "#D97706",
        muted: "#78716C",
      },
      fontFamily: {
        // Шрифты подключены в app/layout.tsx (@fontsource, self-hosted)
        sans: ['"Manrope Variable"', "Manrope", "system-ui", "sans-serif"],
        serif: ['"Cormorant Garamond"', "Georgia", "serif"],
      },
      borderRadius: {
        card: "1.5rem",
        button: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
