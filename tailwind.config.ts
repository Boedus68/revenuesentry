import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // Questo è il percorso corretto per dire a Tailwind
    // di leggere tutti i file dentro la cartella "app"
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;