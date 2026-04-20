import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// In demo mode, swap the Tauri-backed adapters for browser-only stubs so
// the same React app runs inside a plain iframe. Implemented as a Rollup
// resolveId plugin so the swap survives relative imports from the barrel
// (`./fs`, `./dialog`) — a plain `resolve.alias` entry can't see those.
const adapterSwap = (): Plugin => {
  const swaps: Record<string, string> = {
    'fs.ts': 'fs.demo.ts',
    'dialog.ts': 'dialog.demo.ts',
  }
  return {
    name: 'ccm:demo-adapter-swap',
    enforce: 'pre',
    async resolveId(id, importer, opts) {
      if (!importer) return null
      const resolved = await this.resolve(id, importer, { ...opts, skipSelf: true })
      if (!resolved || resolved.external) return null
      const norm = resolved.id.replace(/\\/g, '/')
      for (const [from, to] of Object.entries(swaps)) {
        if (norm.endsWith(`/src/adapters/${from}`)) {
          return norm.replace(new RegExp(`${from.replace('.', '\\.')}$`), to)
        }
      }
      return null
    },
  }
}

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
    define: {
      'import.meta.env.VITE_DEMO': JSON.stringify(demo),
    },
    plugins: [react(), tailwind(), ...(demo ? [adapterSwap()] : [])],
    base: demo ? '/demo/' : '/',
    build: demo
      ? {
          outDir: 'dist-demo',
          emptyOutDir: true,
        }
      : undefined,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      watch: { ignored: ['**/src-tauri/**'] },
    },
  }
})
