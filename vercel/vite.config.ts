import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import base from '../netlify/vite.config';

// Same React UI and static PWA assets, separate from the Cloudflare build.
export default defineConfig(mergeConfig(base, {
  build: { outDir: fileURLToPath(new URL('../dist-vercel/', import.meta.url)) },
}));
