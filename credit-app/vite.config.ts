import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/credit/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Fix for some web3 packages
    'process.env': {},
    global: 'globalThis',
  },
  css: {
    postcss: './postcss.config.js',
  },
  build: {
    outDir: 'dist',
  },
})
