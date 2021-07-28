const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  purge: {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    options: {
      safelist: [
        "bg-red-300",
        "bg-yellow-300",
        "bg-green-300",
        "bg-blue-300",
        "bg-purple-300",
        "bg-pink-300",
      ],
    },
  },
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        primary: "#243E8B",
        secondary: {
          100: "#FFB81C",
          200: "#F8E3B4",
        },
      },
      fontFamily: {
        sans: ["Poppins", ...defaultTheme.fontFamily.sans],
      },
      textColor: {
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
