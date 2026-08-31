import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import { reportHeightToParent } from './lib/embedHeight';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    {/*
      Vercel Web Analytics. Renders nothing; injects /_vercel/insights/script.js,
      which patches history itself — so react-router navigations between wheels
      are counted without wiring anything here. Cookieless, so no consent banner.
      `mode` is explicit because the SDK sniffs process.env.NODE_ENV, which Vite
      does not define in the browser: without it, `npm run dev` posts to an
      endpoint that only exists on Vercel.
    */}
    <Analytics mode={import.meta.env.DEV ? 'development' : 'production'} />
  </React.StrictMode>,
);

// If this page is inside an iframe, keep the parent informed of our height so
// the frame can auto-resize (see docs/EMBEDDING.md for the parent snippet).
// Harmless no-op when running standalone.
reportHeightToParent();
