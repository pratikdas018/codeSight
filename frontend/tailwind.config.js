/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102035",
        glow: "#f5b700",
        mist: "#eff5ff",
        coral: "#ff785a",
      },
      boxShadow: {
        panel: "0 24px 80px rgba(16, 32, 53, 0.12)",
      },
    },
  },
  plugins: [],
};
