import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // If you are deploying to a subdirectory, set the base path accordingly
  // base: '/elearning/',
  build: {
    // 'hidden' emits .map files (useful if you ever wire up Sentry/Bugsnag)
    // but does NOT add the sourceMappingURL comment to the bundle, so the
    // map isn't auto-discoverable from a deployed page.
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        // Explicit vendor splits. Without this, Rollup groups by shared-import
        // graph, which puts Radix primitives + lucide icons into the same
        // shared chunk as tiny hooks they happen to co-depend with (the
        // "useDocumentTitle-XXX.js" chunk that ballooned to 76KB on every
        // page). Splitting heavyweight vendors out by package gives the
        // browser proper long-term caching too — a UI patch won't bust
        // the lucide chunk and vice versa.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@radix-ui')) return 'radix'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('sonner')) return 'sonner'
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'forms'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})