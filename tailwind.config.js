const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  safelist: [
    "bg-red-300",
    "bg-yellow-300",
    "bg-green-300",
    "bg-blue-300",
    "bg-purple-300",
    "bg-pink-300",
  ],
  darkMode: "media",
  theme: {
    extend: {
      // Scheme-dependent colours are custom properties defined in
      // src/styles/helpers/_theme.scss; these are just their Tailwind names.
      colors: {
        primary: "#243E8B",
        // Fixed navy for text on a fixed gold band (see textColor.primary below,
        // which lifts in dark mode and would wash out on gold).
        navy: "#243E8B",
        secondary: {
          100: "#FFB81C",
          200: "#F8E3B4",
        },
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          sunken: "var(--surface-sunken)",
          accent: "var(--surface-accent)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
          brand: "var(--ink-brand)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
      },
      fontFamily: {
        sans: ["Poppins", ...defaultTheme.fontFamily.sans],
      },
      textColor: {
        // Navy text lifts in dark mode; navy backgrounds (bg-primary) don't.
        primary: "var(--ink-brand)",
        secondary: {
          100: "#FFB81C",
          200: "#F8E3B4",
        },
      },
    },
  },
  variants: {
    extend: {
      display: ["group-hover"],
      padding: ["group-hover"],
      transform: ["group-hover"],
      scale: ["group-hover"],
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
