import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'player-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'player.html'),
      output: {
        // Name the output index.html so the server finds it easily
        entryFileNames: 'assets/player-[hash].js',
        chunkFileNames: 'assets/player-chunk-[hash].js',
        assetFileNames: 'assets/player-[hash].[ext]',
      },
    },
  },
  define: {
    __IS_PLAYER__: true,
  },
  // Base path must be / for the express server
  base: '/',
})