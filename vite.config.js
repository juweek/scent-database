import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { contentTokens, fillTokens } from './scripts/contentTokens.mjs';

// `base` is the ONE knob for serving from a subpath (e.g. embedded under
// /tools/air/). On Vercel/Cloudflare root deploys, leave it '/'.
// Override per-build with:  VITE_BASE=/tools/air/ npm run build
export default defineConfig(() => {
  const site = (process.env.VITE_SITE_URL || 'https://scent-database.vercel.app').replace(
    /\/$/,
    '',
  );

  // Crawlers have to be able to reach the prose. Nothing here is disallowed.
  const robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`;
  // The routes in src/App.jsx. Client routed, so every one of them is served the same
  // index.html, which is why the static prose in that file has to be about the project rather
  // than about any single wheel.
  const ROUTES = [
    '/',
    '/wheel/accord',
    '/wheel/accords',
    '/wheel/family',
    '/wheel/pyramid',
    '/perfume',
    '/builder',
  ];
  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...ROUTES.map((path) => `<url><loc>${site}${path}</loc><changefreq>monthly</changefreq></url>`),
    '</urlset>',
    '',
  ].join('\n');
  const statics = {
    '/robots.txt': [robotsTxt, 'text/plain'],
    '/sitemap.xml': [sitemapXml, 'application/xml'],
  };

  return {
    base: process.env.VITE_BASE || '/',
    plugins: [
      react(),
      {
        // Fills the figures quoted by the static prose, and emits the two files a crawler
        // looks for. See scripts/contentTokens.mjs for where the numbers come from.
        name: 'publisher-content',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const entry = statics[req.url?.split('?')[0]];
            if (!entry) return next();
            res.setHeader('Content-Type', `${entry[1]}; charset=utf-8`);
            res.end(entry[0]);
          });
        },
        transformIndexHtml(html) {
          // Recomputed per request so `npm run dev` reflects a rebake without a restart.
          return fillTokens(html, contentTokens(site));
        },
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt });
          this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml });
        },
      },
    ],
    // p5 is deliberately one big lazy chunk (see src/viz/P5Sketch.jsx); don't
    // warn about it on every build.
    build: { chunkSizeWarningLimit: 1200 },
  };
});
