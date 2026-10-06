import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, /api requests are proxied to the backend so the admin
// cookie is same-origin. In production set VITE_API_URL instead.
// The second, server-side build (for scripts/prerender.js) skips public/.
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  build: {
    copyPublicDir: !isSsrBuild,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
}))
