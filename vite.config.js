import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is the ONE knob for serving from a subpath (e.g. embedded under
// /tools/air/). On Vercel/Cloudflare root deploys, leave it '/'.
// Override per-build with:  VITE_BASE=/tools/air/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  // p5 is deliberately one big lazy chunk (see src/viz/P5Sketch.jsx); don't
  // warn about it on every build.
  build: { chunkSizeWarningLimit: 1200 },
});
