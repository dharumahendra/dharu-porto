import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Matches the `@/*` path in tsconfig.json so shadcn's generated imports resolve.
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the rarely-changing libraries out of the app chunk so a content
        // edit doesn't force visitors to re-download all of React + Framer.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion', 'lenis'],
        },
      },
    },
  },
})
