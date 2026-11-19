/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sheldon: {
          bg: '#0E0B0A',
          card: '#181311',
          border: '#2E231E',
          orange: '#F97316',
          orangeHover: '#EA580C',
          golden: '#FBBF24',
          cream: '#FDE6C4',
          espresso: '#3B2314',
          coral: '#FB7185',
          tear: '#38BDF8',
          muted: '#B8A99E',
          subtle: '#7C6D63',
        },
        figma: {
          bg: '#F5F6FA',
          card: '#FFFFFF',
          textMain: '#242424',
          textMuted: '#6D6D6D',
          orange: '#FB7213',
          orangeHover: '#E06209',
          gold: '#FEB14A',
          peach: '#FECCAA',
          brown: '#55321E',
          focusBg: '#2D2E30',
          focusControl: '#404244',
          focusDivider: '#5E6064',
          eventBg: '#DFF3FE',
          eventText: '#034163',
          kanbanCol: '#1E1F24',
          kanbanCard: '#2B2C32',
          kanbanCardHover: '#35363D',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Segoe UI Variable Display"', '"Segoe UI"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        rounded: ['Nunito', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'orange-glow': '0 0 28px -4px rgba(249, 115, 22, 0.42)',
        'orange-glow-sm': '0 0 14px -2px rgba(249, 115, 22, 0.28)',
        'kawaii-card': '0 10px 30px -10px rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(253, 230, 196, 0.06)',
        'figma-card': '0 4px 20px -2px rgba(0, 0, 0, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        'figma-floating': '0 20px 40px -10px rgba(0, 0, 0, 0.35)',
      },
      keyframes: {
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.03)' },
        },
      },
      animation: {
        'float-slow': 'float-slow 3.2s ease-in-out infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
