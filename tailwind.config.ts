import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        accent: { DEFAULT: '#0A84FF', dark: '#30D158' },
      },
      animation: {
        'fade-in': 'fadeIn .4s ease-out',
        'zoom-in': 'zoomIn .18s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        zoomIn: { from: { opacity: '0', transform: 'scale(.96) translateY(8px)' }, to: { opacity: '1', transform: 'scale(1) translateY(0)' } },
      },
    },
  },
  plugins: [],
};
export default config;
