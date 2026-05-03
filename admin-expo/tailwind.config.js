/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Discord palette
        bg: { DEFAULT: "#36393f", deep: "#202225", panel: "#2f3136", input: "#40444b" },
        accent: { DEFAULT: "#5865f2", hover: "#4752c4" },
        ok: "#57f287",
        warn: "#fee75c",
        danger: "#ed4245",
        muted: "#b9bbbe",
        text: "#dcddde",
      },
      fontFamily: {
        sans: ["Inter_400Regular", "System"],
        semibold: ["Inter_600SemiBold", "System"],
        bold: ["Inter_700Bold", "System"],
      },
    },
  },
  plugins: [],
};
