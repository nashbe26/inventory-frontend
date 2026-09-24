import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The dev server proxies everything the API owns, so the app is same-origin in
 * development exactly as it is in a same-origin deployment. That is what lets
 * services/api.js default to the relative '/api-inventory' instead of an
 * absolute localhost URL that could never work off this machine (AUDIT H-7).
 *
 * /socket.io needs ws:true — without it the websocket upgrade is not proxied,
 * and the client silently falls back to polling or fails outright.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3004,
    proxy: {
      '/api-inventory': {
        target: 'http://localhost:3009',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3009',
        changeOrigin: true,
        ws: true
      },
      '/uploads': {
        target: 'http://localhost:3009',
        changeOrigin: true
      }
    }
  }
})
