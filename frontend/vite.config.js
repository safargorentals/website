import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, /api requests are proxied to the backend so the admin
// cookie is same-origin. In production set VITE_API_URL instead.
// API_PROXY_TARGET picks the backend: the local one by default, or e.g.
// API_PROXY_TARGET=https://drivekochi.in npm run dev to use the live site's
// data (careful: admin changes then change the live site).
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:3000'

// The second, server-side build (for scripts/prerender.js) skips public/.
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  build: {
    copyPublicDir: !isSsrBuild,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
}))
