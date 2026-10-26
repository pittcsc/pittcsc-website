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
      colors: {
        pittNavy: "#1d2758",
        pittDeepNavy: "#1d2758",
        pittDarkNavy: "#141a3d",
        pittGold: "#FFB81C",
        pittLight: "#f6f7f9",
        pittGray: { 100: "#f3f4f6", 400: "#9ca3af", 500: "#6b7280" },
        primary: "#243E8B",
        secondary: {
          100: "#FFB81C",
          200: "#F8E3B4",
        },
      },
      boxShadow: {
        soft: "0 2px 8px rgba(0,0,0,.08)",
        medium: "0 4px 16px rgba(0,0,0,.12)",
      },
      backgroundImage: {
        "gradient-pitt": "linear-gradient(135deg,#1d2758,#2a3670)",
      },
      fontFamily: {
        sans: ["Poppins", ...defaultTheme.fontFamily.sans],
      },
      textColor: {
        pittNavy: "#1d2758",
        pittDeepNavy: "#1d2758",
        pittDarkNavy: "#141a3d",
        pittGold: "#FFB81C",
        pittLight: "#f6f7f9",
        pittGray: { 100: "#f3f4f6", 400: "#9ca3af", 500: "#6b7280" },
        primary: "#243E8B",
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
