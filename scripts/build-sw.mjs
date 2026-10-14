import { generateSW } from 'workbox-build';

const result = await generateSW({
  globDirectory: 'out',
  globPatterns: ['**/*.{html,js,css,svg,png,woff2,webmanifest,txt}'],
  globIgnores: ['sw.js', 'workbox-*.js'],
  swDest: 'out/sw.js',
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/_next\//],
  cacheId: 'rubik-pandu',
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: false,
  sourcemap: false,
});
for (const warning of result.warnings) console.warn(warning);
console.log(`PWA: ${result.count} files cached (${Math.round(result.size / 1024)} KiB), including the local solver worker.`);
