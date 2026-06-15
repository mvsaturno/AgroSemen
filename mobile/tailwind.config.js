/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#2E7D32',
          DEFAULT: '#1B5E20',
          dark: '#0A3D11',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          background: '#E8F5E9',
        },
        danger: '#D32F2F',
        warning: '#FBC02D',
      }
    },
  },
  plugins: [],
}
