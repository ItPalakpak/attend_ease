/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Redefine primary to Logistics Vibrant Racing Yellow (Car Tint Style)
        primary: {
          50: '#fffdf0',
          100: '#fffac2',
          200: '#fff28a',
          300: '#ffe647',
          400: '#ffdc0d',
          500: '#ffd300',
          600: '#e6be00',
          700: '#b89800',
          800: '#8a7200',
          900: '#5c4c00'
        },
        // Map sky, blue, and indigo to primary Yellow scale so all standard theme brand colors switch automatically
        sky: {
          50: '#fffdf0',
          100: '#fffac2',
          200: '#fff28a',
          300: '#ffe647',
          400: '#ffdc0d',
          500: '#ffd300',
          600: '#e6be00',
          700: '#b89800',
          800: '#8a7200',
          900: '#5c4c00'
        },
        blue: {
          50: '#fffdf0',
          100: '#fffac2',
          200: '#fff28a',
          300: '#ffe647',
          400: '#ffdc0d',
          500: '#ffd300',
          600: '#e6be00',
          700: '#b89800',
          800: '#8a7200',
          900: '#5c4c00'
        },
        indigo: {
          50: '#fffdf0',
          100: '#fffac2',
          200: '#fff28a',
          300: '#ffe647',
          400: '#ffdc0d',
          500: '#ffd300',
          600: '#e6be00',
          700: '#b89800',
          800: '#8a7200',
          900: '#5c4c00'
        }
      }
    }
  },
  plugins: []
}
