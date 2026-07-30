import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'

export default defineConfig({
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 600,
  },
  plugins: [preact()],
})
