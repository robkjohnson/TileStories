import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  build: {
    rollupOptions: {
      input: {
        main:    resolve(__dirname, 'index.html'),
        display: resolve(__dirname, 'display.html'),
      }
    }
  },
  appType: 'mpa',   // multi-page app — Vite serves each .html at its own route without SPA fallback
})