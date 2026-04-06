/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './index.ts',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './theme/**/*.{js,jsx,ts,tsx}'
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#f8fafc',
          'bg-dark': '#0f172a',
          surface: '#ffffff',
          'surface-dark': '#111827',
          card: '#fdfdfd',
          'card-dark': '#1e293b',
          muted: 'rgba(15,23,42,0.55)',
          'muted-dark': 'rgba(248,250,252,0.65)'
        }
      }
    }
  },
  plugins: []
};
