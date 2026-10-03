import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, /api requests are proxied to the backend so the admin
// cookie is same-origin. In production set VITE_API_URL instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
