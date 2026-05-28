import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // If you are deploying to a subdirectory, set the base path accordingly
  // base: '/elearning/',
  build: {
    // 'hidden' emits .map files (useful if you ever wire up Sentry/Bugsnag)
    // but does NOT add the sourceMappingURL comment to the bundle, so the
    // map isn't auto-discoverable from a deployed page.
    sourcemap: 'hidden',
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