import type { Config } from "tailwindcss";

// Tokens from design/stitch/learnly_calm_edtech_system/DESIGN.md.
// Components must use these names, never raw hex values.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "var(--color-primary)", hover: "var(--color-primary-hover)", ring: "var(--color-primary-ring)" },
        accent: "var(--color-accent)",
        canvas: "var(--color-canvas)",
        card: "var(--color-card)",
        border: { DEFAULT: "var(--color-border)", hover: "var(--color-border-hover)" },
        stage: { DEFAULT: "var(--color-stage)", tile: "var(--color-stage-tile)", bar: "var(--color-stage-bar)" },
        ink: { DEFAULT: "var(--color-text)", secondary: "var(--color-text-secondary)", muted: "var(--color-text-muted)" },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        info: "var(--color-info)",
        subject: {
          blue: "var(--subject-blue)", coral: "var(--subject-coral)", slate: "var(--subject-slate)",
          purple: "var(--subject-purple)", teal: "var(--subject-teal)", amber: "var(--subject-amber)",
        },
        chip: {
          "done-bg": "var(--chip-done-bg)", "done-fg": "var(--chip-done-fg)",
          "due-bg": "var(--chip-due-bg)", "due-fg": "var(--chip-due-fg)",
          "late-bg": "var(--chip-late-bg)", "late-fg": "var(--chip-late-fg)",
        },
      },
      fontFamily: { sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"] },
      fontSize: {
        "headline-xl": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-xl-mobile": ["28px", { lineHeight: "36px", letterSpacing: "-0.015em", fontWeight: "700" }],
        "headline-lg": ["24px", { lineHeight: "32px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px" }],
        "body-md": ["14px", { lineHeight: "20px" }],
        "label-md": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "500" }],
        caption: ["12px", { lineHeight: "16px" }],
      },
      borderRadius: { card: "1rem", field: "0.5rem", pill: "9999px" },
      boxShadow: {
        card: "0 1px 3px 0 rgb(15 23 42 / 0.04)",
        "card-hover": "0 4px 12px -2px rgb(15 23 42 / 0.08)",
        overlay: "0 12px 28px -4px rgb(15 23 42 / 0.16)",
        focus: "0 0 0 3px rgb(37 99 235 / 0.15)",
      },
      spacing: { gutter: "1.5rem", "gutter-sm": "1rem", margin: "2rem", "margin-sm": "1rem" },
    },
  },
  plugins: [],
};

export default config;
