import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Copies `./edge-functions` into `dist/edge-functions` after build so that
 * uploading the `dist` folder directly to Tencent EdgeOne Pages deploys
 * both static assets and Edge Functions (`/api/*`).
 */
function copyEdgeFunctionsPlugin() {
  return {
    name: 'copy-edgeone-edge-functions',
    closeBundle() {
      const srcDir = resolve(process.cwd(), 'edge-functions');
      const destDir = resolve(process.cwd(), 'dist', 'edge-functions');
      if (existsSync(srcDir)) {
        cpSync(srcDir, destDir, { recursive: true });
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyEdgeFunctionsPlugin()],
  build: {
    outDir: 'dist',
    target: 'es2020'
  }
});
