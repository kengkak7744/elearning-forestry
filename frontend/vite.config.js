import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/elearning/',
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
        // Explicit chunk groups via Rolldown's native advancedChunks API.
        //
        // We deliberately do NOT use the Rollup-compat `manualChunks(id)` shim:
        // it treats the returned name as a soft hint and *relocates* a module
        // assigned to a small chunk into whichever larger chunk has more
        // consumers. That silently defeated the `radix-core` split — Slot /
        // Primitive / compose-refs kept getting vacuumed back into the heavy
        // Radix overlay chunk because the overlays out-number the one login-page
        // consumer. `advancedChunks` honours `priority` authoritatively: the
        // highest-priority group that matches a module wins, full stop.
        //
        // Goal of the split: keep the pre-auth login screen's eager graph lean.
        // Login renders zero overlays — it only needs Slot (via Button) + Label
        // — yet a monolithic Radix chunk forced it to download all of
        // dialog/select/popover/dropdown (~44KB gzip). Likewise React itself is
        // stable across deploys, so it gets its own long-lived chunk.
        //
        // (`codeSplitting` is Rolldown's current name for what was previously
        // exposed as `advancedChunks`; same shape, no deprecation warning.)
        codeSplitting: {
          groups: [
            // --- Stable third-party libraries (highest priority so recursive
            //     dependency inclusion from the app groups can't vacuum them up) ---
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react-router-dom|react-router|react-dom|scheduler|react)[\\/]/,
              priority: 50,
            },
            { name: 'icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/, priority: 50 },
            { name: 'sonner', test: /[\\/]node_modules[\\/]sonner[\\/]/, priority: 50 },
            {
              name: 'forms',
              test: /[\\/]node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/,
              priority: 50,
            },
            // --- Radix foundation: the only Radix code login touches. Must
            //     out-rank the overlay group so it claims Slot/Label/Primitive/
            //     compose-refs first; the overlays then import them from here
            //     (correct lazy→eager direction). Matches nested copies too. ---
            {
              name: 'radix-core',
              test: /[\\/]@radix-ui[\\/]react-(slot|label|primitive|compose-refs)[\\/]/,
              priority: 45,
            },
            // --- Everything else in Radix: the heavy interactive overlays,
            //     loaded lazily only on routes that actually render them. ---
            { name: 'radix', test: /[\\/]@radix-ui[\\/]/, priority: 30 },
            // --- Tiny app-level utilities even the login screen needs. Kept out
            //     of the larger shared-component chunk (whose members import
            //     lucide + Radix overlays) so login doesn't transitively preload
            //     ~50KB gzip of icons/dialogs it never renders. Lowest priority:
            //     its node_modules deps (clsx/tailwind-merge) fall in here, but
            //     anything claimed by a vendor group above (e.g. sonner via the
            //     toast helper) stays in that vendor chunk. ---
            {
              name: 'app-core',
              test: /[\\/]src[\\/](hooks[\\/]useDocumentTitle|lib[\\/]utils|lib[\\/]toast|constants[\\/]labels|utils[\\/]apiError)\.js/,
              priority: 20,
            },
          ],
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