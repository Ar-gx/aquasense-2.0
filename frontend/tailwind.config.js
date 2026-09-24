/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "earthy field" palette — cream canvas · moss green lead · dusty blue
        // secondary · walnut brown accent · wheat yellow highlight
        ink: "#23190f",      // warm walnut-black — headings & strong text
        canvas: "#faf7ef",   // cream page background
        night: "#f3eee2",    // warm beige inset — inputs, tracks, table stripes
        panel: "#fdfbf6",    // cream cards & surfaces
        line: "#e7dfcf",     // warm sand-taupe borders
        mist: "#65594b",     // muted warm-taupe body text (AA on cream)
        leaf: {
          50: "#f4f7ee", 100: "#e6eed8", 200: "#cdddb7", 300: "#adcb8e",
          400: "#8ab365", 500: "#6d9a4c", 600: "#577c3c", 700: "#456231",
          800: "#364d28", 900: "#26361d",
        },
        aqua: {
          50: "#eff4f7", 100: "#dde8ef", 200: "#bdd1de", 300: "#97b5ca",
          400: "#7199b5", 500: "#557f9d", 600: "#446784", 700: "#38546b",
          800: "#2f4457", 900: "#22323f",
        },
        soil: {
          50: "#f8f4ec", 100: "#f0e7d7", 200: "#e2d2b9", 300: "#cfb994",
          400: "#b89b70", 500: "#a18055", 600: "#866643", 700: "#6b5136",
          800: "#513d29", 900: "#392b1d",
        },
        sand: {
          50: "#fdf9ec", 100: "#f8efd3", 200: "#f1e1ad",
          300: "#f4e4ab", 400: "#e6cd77", 500: "#d4ac45",
          600: "#b08a26", 700: "#8a6a14", 800: "#6d520f",
        },
        alert: { 400: "#f0907c", 500: "#dd6d52", 600: "#b84a35", 700: "#9a3d2c" },
        warn: { 300: "#fbe6a3", 400: "#f2d477", 500: "#dfb547", 600: "#8f6c15", 700: "#74560f" },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(35,25,15,0.05), 0 16px 32px -22px rgba(35,25,15,0.20)",
        glow: "0 0 40px -12px rgba(109,154,76,0.40)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 1px 1px, rgba(107,81,54,0.15) 1px, transparent 0)",
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        drift: {
          "0%": { transform: "translateX(-4%) translateY(0)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { transform: "translateX(4%) translateY(-40px)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        stream: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "30%": { opacity: "1" },
          "100%": { transform: "translateY(300%)", opacity: "0" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        stream: "stream 3.2s linear infinite",
      },
    },
  },
  plugins: [],
};
