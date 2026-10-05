import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/adminpanel': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
