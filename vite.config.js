import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    cors: true,
    hmr: {
      host: '127.0.0.1'
    },
    open: 'http://127.0.0.1:5173'
  },
  // Pass through all VITE_* env vars to the client bundle
  envPrefix: 'VITE_',
})
