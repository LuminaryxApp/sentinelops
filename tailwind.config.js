/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // VS Code-inspired color palette
        editor: {
          bg: '#1E1E1E',
          sidebar: '#252526',
          active: '#37373D',
          border: '#3E3E42',
          text: '#D4D4D4',
          muted: '#808080',
          accent: '#007ACC',
        },
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
