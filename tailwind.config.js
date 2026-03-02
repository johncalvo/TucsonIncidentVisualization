export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0a0f1e',       // Deep navy background
          panel: '#111827',    // Card/panel background
          border: '#1f2937',   // Subtle borders
          accent: '#06b6d4',   // Cyan accent
          warn: '#f97316',     // Orange for alerts
          danger: '#ef4444',   // Red for violent crime
          safe: '#22c55e',     // Green
          muted: '#6b7280',    // Muted text
          text: '#f9fafb',     // Primary text
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

