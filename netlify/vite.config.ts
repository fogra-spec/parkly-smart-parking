import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
  css: { postcss: fileURLToPath(new URL('../', import.meta.url)) },
  build: {
    outDir: fileURLToPath(new URL('../dist-netlify/', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
