/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['"Bodoni Moda"', 'Didot', 'Georgia', 'serif'],
        sans: ['Manrope', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"SFMono-Regular"', 'Consolas', 'monospace'],
      },
      colors: {
        // The Jade Standard — Sorora's brand palette, derived from a set of
        // jade paint swatches (Valspar/Behr/Sherwin-Williams/Benjamin Moore).
        jade: {
          50: '#F1F7F5',
          100: '#DCEDE8',
          200: '#B9DAD1',
          300: '#8FC2B3',
          400: '#5FAE9A',
          500: '#3D9483',
          600: '#296F62',
          700: '#1F5450',
          800: '#173F3C',
          900: '#0F2D2A',
        },
        moss: {
          DEFAULT: '#4B6E5A',
          50: '#E4EBE2',
          100: '#D2DFCE',
          500: '#4B6E5A',
          700: '#374F3F',
        },
        sage: {
          DEFAULT: '#AEBBA4',
          50: '#E7ECE1',
          100: '#DCE4D5',
        },
        gold: {
          50: '#F8F0DC',
          100: '#F2E6C6',
          200: '#E9D39C',
          300: '#DABE72',
          400: '#C7A452',
          500: '#AD8636',
          600: '#8E6E29',
          700: '#6E551F',
          800: '#4F3D16',
          900: '#33280E',
        },
        brick: {
          DEFAULT: '#9E5641',
          50: '#F6E9E4',
          100: '#F0DCD3',
          200: '#E2BBAE',
          300: '#CD9683',
          400: '#B7745C',
          500: '#9E5641',
          600: '#7F4433',
          700: '#603327',
          800: '#42221A',
          900: '#291410',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
