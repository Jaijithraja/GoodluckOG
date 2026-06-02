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
        // Direct tokens mapping for styling flexibility
        bg: {
          base: "var(--bg-base)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          sunken: "var(--bg-sunken)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          light: "var(--accent-light)",
          text: "var(--accent-text)",
        },
        success: {
          DEFAULT: "var(--success)",
          light: "var(--success-light)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          light: "var(--warning-light)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          light: "var(--danger-light)",
        },
        info: {
          DEFAULT: "var(--info)",
          light: "var(--info-light)",
        },
        varc: "var(--varc)",
        dilr: "var(--dilr)",
        quant: "var(--quant)",
        
        // Legacy/Component mappings to keep full backward compatibility
        primary: "var(--bg-base)",
        surface: "var(--bg-surface)",
        card: "var(--bg-elevated)",
        borderMuted: "var(--border)",
        accentPrimary: "var(--accent)",
        accentSecondary: "var(--warning)",
        successGreen: "var(--success)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "var(--radius-lg)",
        input: "var(--radius-md)",
        badge: "9999px",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        warm: "0 2px 8px rgba(28, 22, 22, 0.06)",
        warmLg: "0 10px 25px -5px rgba(28, 22, 22, 0.08), 0 8px 10px -6px rgba(28, 22, 22, 0.08)",
      }
    },
  },
  plugins: [],
};
export default config;
