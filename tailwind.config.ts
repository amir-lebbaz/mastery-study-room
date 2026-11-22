import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "midnight-ink": "#242D36",
        "stormy-slate": "#536372",
        "eerie-sage": "#899C96",
        "silver-fog": "#BBC5C5",
        "spectral-white": "#EDF0E9",
      },
      fontFamily: {
        arabic: ["Cairo", "IBM Plex Sans Arabic", "Segoe UI", "Tahoma", "sans-serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      borderRadius: {
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
