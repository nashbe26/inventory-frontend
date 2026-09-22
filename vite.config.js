import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3004,
    proxy: {
      '/api-inventory': {
        target: 'http://localhost:3009',
        changeOrigin: true
      }
    }
  }
})
