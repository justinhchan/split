import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Plain Vite config used to ship the renderer as a static web demo to GitHub
 * Pages. We can't use electron-vite here because the electron-vite renderer
 * pipeline assumes a preload bridge and emits an Electron-shaped bundle.
 *
 * Behavioural diffs from the desktop build:
 *  - `window.api` is undefined, so `lib/ipc.ts` falls back to localStorage.
 *  - `window.electron` is undefined; the `IS_MAC` check in App.tsx becomes
 *    false, which is fine — that branch only tweaks platform-specific keybinds.
 */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: '/split/',
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'out/web'),
    emptyOutDir: true,
    sourcemap: false
  }
})
