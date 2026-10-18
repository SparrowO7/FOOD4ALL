import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80",
          500: "#22c55e", 600: "#16a34a", 700: "#15803d", 800: "#166534", 900: "#14532d",
        },
        accent: {
          50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74",
          400: "#fb923c", 500: "#f97316", 600: "#ea580c",
        },
        ink: { 900: "#0f172a", 700: "#334155", 500: "#64748b" },

        // ── Landing-page palette ────────────────────────────────────────
        // Grounded in Indian enamelware and `anna daan` (food as offering):
        // deep bottle green for freshness, marigold for the offering, steel
        // for the tiffin. Chilli is functional only — expiring timers.
        rescue: {
          deep: "#06251C",
          green: "#0C3F2E",
          moss: "#15543E",
          marigold: "#F5B312",
          ember: "#E8921B",
          steel: "#C9D4CE",
          paper: "#FBF9F3",
          chilli: "#E0452C",
        },
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "Inter", "system-ui", "Segoe UI", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        // Tall, narrow, high x-height — reads like painted signage at large
        // sizes. Only used above ~2rem, where its thin strokes hold up.
        board: ["var(--font-darker)", "Impact", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 20px rgba(15,23,42,.06)",
        card: "0 8px 30px rgba(15,23,42,.08)",
        float: "0 20px 50px rgba(15,23,42,.14)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        in: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        float: "float 5s ease-in-out infinite",
        shimmer: "shimmer 1.5s linear infinite",
        in: "in .4s ease-out both",
      },
      backgroundImage: {
        mesh: "radial-gradient(at 20% 20%, #dcfce7 0, transparent 50%), radial-gradient(at 90% 10%, #ffedd5 0, transparent 40%), radial-gradient(at 50% 90%, #e0f2fe 0, transparent 45%)",
        "mesh-dark": "radial-gradient(at 18% 16%, rgba(34,197,94,.18) 0, transparent 52%), radial-gradient(at 92% 10%, rgba(251,146,60,.16) 0, transparent 42%), radial-gradient(at 50% 88%, rgba(56,189,248,.14) 0, transparent 48%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
