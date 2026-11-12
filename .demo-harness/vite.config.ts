import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
const repo = path.resolve(__dirname, '..');
export default defineConfig(() => ({
  root: repo,
  envDir: repo,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': repo } },
  server: { port: 5201, strictPort: true, fs: { allow: [repo] },
    proxy: { '/api': { target: 'https://buck-ai-team-3.vercel.app', changeOrigin: true } } },
}));
