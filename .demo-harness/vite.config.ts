import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
const repo = path.resolve(__dirname, '..');
export default defineConfig(() => ({
  root: repo,
  envDir: repo,
  plugins: [react(), tailwindcss()],
  // App's office hours come from fictional sample rows (officeHoursSample.ts), never the OSU-only table
  resolve: { alias: [{ find: '@', replacement: repo }, { find: /^\.\/lib\/officeHours$/, replacement: path.join(__dirname, 'officeHoursSample.ts') }] },
  server: { port: 5201, strictPort: true, fs: { allow: [repo] },
    proxy: { '/api': { target: 'https://buck-ai-team-3.vercel.app', changeOrigin: true } } },
}));
