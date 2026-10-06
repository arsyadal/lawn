import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#18211b',
        paper: '#f4f5ef',
        panel: '#ffffff',
        moss: '#24613e',
        'moss-dark': '#17462c',
        clay: '#c75a3a',
        line: '#d9ddd3',
        muted: '#687269',
        wash: '#e8eee8',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(24,33,27,.06), 0 10px 30px rgba(24,33,27,.05)',
      },
      fontFamily: {
        sans: ['var(--font-fira-sans)', 'sans-serif'],
        mono: ['var(--font-fira-code)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
