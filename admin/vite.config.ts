import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this app at /lgu-attendance-app/ (project site).
  // For a root-domain host (e.g. Netlify) change base back to '/'.
  base: '/lgu-attendance-app/',
  server: { port: 5173 },
});
