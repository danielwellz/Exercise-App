import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 35px rgba(15, 23, 42, 0.12)',
      },
      colors: {
        brand: {
          50: '#f2fbf9',
          100: '#dcf5ef',
          500: '#24b08f',
          600: '#1f9076',
          700: '#1f7460',
        },
      },
    },
  },
  plugins: [],
};

export default config;
