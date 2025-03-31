/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        secondary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        dark: {
          50: '#374151',  // Aggiunto questo colore
          100: '#1E2026',
          200: '#191B1F',
          300: '#14161A',
          400: '#0F1114',
          500: '#0A0C0E',
          600: '#050709',
          700: '#000203',
          800: '#000000',
          900: '#000000',
        },
        trading: {
          buy: '#00C853',
          sell: '#FF3D00',
          neutral: '#64748B',
          chart: '#2962FF',
          grid: '#1E2026',
          text: '#E2E8F0',
          muted: '#64748B',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-market': 'linear-gradient(to bottom, rgba(30, 32, 38, 0.95), rgba(20, 22, 26, 0.95))',
      },
    },
  },
  plugins: [],
};