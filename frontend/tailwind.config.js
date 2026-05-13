/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Geist", "SF Pro Display", "Segoe UI", "sans-serif"],
        display: ["Geist", "Inter", "SF Pro Display", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      colors: {
        abyss: "#07111f",
        midnight: "#0d1726",
        panel: "#111d2d",
        ink: "#102035",
        glow: "#63e7ff",
        electric: "#2ba8ff",
        mist: "#eff5ff",
        coral: "#ff785a",
        mint: "#59f7cb",
      },
      boxShadow: {
        panel: "0 24px 80px rgba(4, 10, 25, 0.5)",
        glow: "0 0 0 1px rgba(109, 233, 255, 0.1), 0 18px 50px rgba(13, 168, 255, 0.18)",
        soft: "0 18px 42px rgba(0, 0, 0, 0.32)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(140,180,220,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(140,180,220,0.08) 1px, transparent 1px)",
      },
      screens: {
        xs: "480px",
        "3xl": "1920px",
        "4xl": "2560px",
      },
    },
  },
  plugins: [],
};
