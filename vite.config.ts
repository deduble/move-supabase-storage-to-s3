import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/move-supabase-storage-to-s3/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@aws-sdk/client-s3', '@aws-sdk/lib-storage']
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure proper chunking for GitHub Pages
    rollupOptions: {
      output: {
        manualChunks: {
          'aws-sdk': ['@aws-sdk/client-s3', '@aws-sdk/lib-storage'],
          'supabase': ['@supabase/supabase-js'],
          'react-vendor': ['react', 'react-dom']
        }
      }
    }
  }
})
