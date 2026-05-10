import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ─────────────────────────────────────────────────────────────────
//  vercelDevApi
//  Dev-only middleware that runs Vercel-style serverless handlers
//  from api/**/*.js inside the Vite dev server, so `npm run dev`
//  can exercise endpoints that only exist as Vercel functions in
//  production.
//
//  Resolution order for a request like GET /api/<a>/<b>/<c>:
//    1. api/<a>/<b>/<c>.js  (exact static file)
//    2. api/<a>/<b>/[param].js  (single-segment dynamic, last
//       segment becomes req.query.<param>)
//
//  req/res shim matches the subset of the Vercel interface that the
//  handlers in this repo rely on: req.query, req.body (JSON-parsed
//  when Content-Type says so), res.status().json(), res.end().
//
//  Scope: dev only (apply: 'serve'). No-op at build time.
// ─────────────────────────────────────────────────────────────────
function vercelDevApi({ apiRoot, skipPrefixes = [] } = {}) {
  const root = apiRoot || resolve(process.cwd(), 'api');

  function resolveRoute(pathname) {
    const parts = pathname
      .replace(/^\/api\//, '')
      .split('/')
      .filter(Boolean);
    if (parts.length === 0) return null;

    // Exact static handler
    const staticPath = join(root, ...parts) + '.js';
    if (existsSync(staticPath) && statSync(staticPath).isFile()) {
      return { filePath: staticPath, params: {} };
    }

    // Single-segment dynamic handler: api/<…>/[param].js
    const dir = join(root, ...parts.slice(0, -1));
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      const dyn = readdirSync(dir).find((f) => /^\[[^\]]+\]\.js$/.test(f));
      if (dyn) {
        const name = dyn.match(/^\[([^\]]+)\]\.js$/)[1];
        const value = decodeURIComponent(parts[parts.length - 1]);
        return { filePath: join(dir, dyn), params: { [name]: value } };
      }
    }
    return null;
  }

  function readBody(req) {
    return new Promise((res, rej) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => res(Buffer.concat(chunks)));
      req.on('error', rej);
    });
  }

  function shimRes(res) {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(body));
      return res;
    };
    res.send = (body) => {
      if (body != null && typeof body === 'object' && !(body instanceof Buffer)) {
        return res.json(body);
      }
      res.end(body);
      return res;
    };
    return res;
  }

  return {
    name: 'vercel-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          if (!url.pathname.startsWith('/api/')) return next();
          if (skipPrefixes.some((p) => url.pathname.startsWith(p))) return next();

          const route = resolveRoute(url.pathname);
          if (!route) return next();

          req.query = {
            ...Object.fromEntries(url.searchParams),
            ...route.params,
          };

          if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            const raw = await readBody(req);
            const ct = req.headers['content-type'] || '';
            if (ct.includes('application/json') && raw.length > 0) {
              try {
                req.body = JSON.parse(raw.toString('utf8'));
              } catch {
                req.body = null;
              }
            } else {
              req.body = raw.length > 0 ? raw.toString('utf8') : undefined;
            }
          }

          shimRes(res);

          // Cache-bust on every request so handler edits hot-reload
          // without a server restart. Static deps (e.g. _cors.js)
          // stay cached by Node — edit those and restart.
          const importUrl = pathToFileURL(route.filePath).href + `?t=${Date.now()}`;
          const mod = await import(importUrl);
          const handler = mod.default;
          if (typeof handler !== 'function') {
            res.statusCode = 500;
            return res.end(`[vercel-dev-api] no default export at ${route.filePath}`);
          }
          await handler(req, res);
          if (!res.writableEnded) res.end();
        } catch (err) {
          console.error('[vercel-dev-api] error:', err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            if (!res.getHeader('Content-Type')) {
              res.setHeader('Content-Type', 'application/json');
            }
            res.end(
              JSON.stringify({
                error: 'Dev middleware error',
                details: String(err?.message || err),
              })
            );
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    vercelDevApi({
      skipPrefixes: ['/api/cboe', '/api/ibkr'],
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
          'radix-vendor': [
            '@radix-ui/react-tooltip',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-dialog',
          ],
          'motion-vendor': ['framer-motion', '@number-flow/react'],
          'table-vendor': ['@tanstack/react-table', '@tanstack/react-virtual'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/cboe': {
        target: 'https://cdn.cboe.com/api/global/delayed_quotes/options',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cboe/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      '/api/ibkr': {
        target: 'https://localhost:5000',
        changeOrigin: true,
        secure: false, // Self-signed certificate
        rewrite: (path) => path.replace(/^\/api\/ibkr/, ''),
      },
    },
  },
});
