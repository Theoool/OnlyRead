/**
 * Development warmup script - keeps API routes hot
 * Run alongside dev server: pnpm dev & pnpm tsx scripts/dev-warmup.ts
 */

const WARMUP_INTERVAL = 30000; // 30 seconds
const API_ENDPOINTS = [
  'http://localhost:3000/api/articles?page=1&pageSize=1',
  'http://localhost:3000/api/stats/learning?period=all',
];

async function warmup() {
  for (const url of API_ENDPOINTS) {
    try {
      const start = Date.now();
      const res = await fetch(url, {
        headers: { 'x-warmup': 'true' },
      });
      const duration = Date.now() - start;
      console.log(`[Warmup] ${url} - ${res.status} (${duration}ms)`);
    } catch (e) {
      // Silently fail if server not ready
    }
  }
}

console.log('[Warmup] Starting dev warmup script...');
console.log('[Warmup] Press Ctrl+C to stop');

// Initial warmup after 5s
setTimeout(warmup, 5000);

// Periodic warmup
setInterval(warmup, WARMUP_INTERVAL);
