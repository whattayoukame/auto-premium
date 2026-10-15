import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// GitHub Pages hosts project sites at /<repository>/ instead of /.
// Its static server cannot rewrite SPA routes. Generate actual route entrypoints
// for the published studio so shared/deep links resolve without an HTTP 404.
// Keep 404.html as a fallback for unexpected routes.
const pagesBase = process.env.PAGES_BASE;
const pagesBuild = pagesBase !== undefined;
const pagesRoutes = [
  'admin',
  's/autopremium',
  's/autopremium/services',
  's/autopremium/booking',
  's/autopremium/my',
];

export default defineConfig({
  base: pagesBase || '/',
  define: { __PAGES_BUILD__: JSON.stringify(pagesBuild) },
  plugins: [react(), ...(pagesBuild ? [{
    name: 'github-pages-spa-fallback',
    async closeBundle() {
      const shell = resolve('dist/index.html');
      await copyFile(shell, resolve('dist/404.html'));
      for (const route of pagesRoutes) {
        const routeDirectory = resolve('dist', route);
        await mkdir(routeDirectory, { recursive: true });
        await copyFile(shell, resolve(routeDirectory, 'index.html'));
      }
    },
  }] : [VitePWA({
    registerType: 'autoUpdate',
    manifest: false,
    workbox: {
      globPatterns: ['**/*.{html,js,css,svg,png,webp,woff2}'],
      navigateFallback: '/index.html',
      runtimeCaching: [{
        urlPattern: ({ url }) => url.hostname === 'images.unsplash.com',
        handler: 'CacheFirst',
        options: { cacheName: 'studio-images', expiration: { maxEntries: 50, maxAgeSeconds: 604800 } }
      }]
    },
    devOptions: { enabled: true }
  })])],
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
