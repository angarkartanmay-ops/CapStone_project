import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { connect } from './db.js';
import { loadUser } from './auth.js';
import { initRealtime } from './game/rooms.js';
import { User } from './models.js';
import { seed } from './seed.js';
import authRoutes from './routes/auth.js';
import tableRoutes from './routes/tables.js';
import playerRoutes from './routes/players.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = (p) => path.join(root, 'node_modules', p);

// ponytail: per-process memory counter; a shared store (Redis) is the upgrade for several servers.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const h = hits.get(req.ip);
    if (!h || h.reset < now) hits.set(req.ip, { count: 1, reset: now + windowMs });
    else if (++h.count > max) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    next();
  };
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss:",
        "frame-ancestors 'none'",
      ].join('; '),
    });
    next();
  });

  app.use(express.json({ limit: '20kb' }));

  // Writes must be JSON: a cross-site HTML form can't send that, which blocks CSRF.
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ error: 'Send JSON with Content-Type: application/json' });
    }
    next();
  });
  app.use('/api', loadUser);
  app.use('/api/auth', rateLimit({ windowMs: 10 * 60 * 1000, max: 40 }), authRoutes);
  app.use('/api/tables', tableRoutes);
  app.use('/api', playerRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'No such endpoint' }));

  // Frontend libraries straight from node_modules: no bundler, plain ES modules.
  app.use('/vendor/three', express.static(mod('three/build')));
  app.use('/vendor/gsap', express.static(mod('gsap')));
  app.use('/vendor/lenis', express.static(mod('lenis/dist')));
  app.use(express.static(path.join(root, 'public'), { extensions: ['html'] }));
  app.use((req, res) => res.status(404).sendFile(path.join(root, 'public', '404.html')));

  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That request body is not valid JSON' });
    if (err.name === 'ValidationError') return res.status(422).json({ error: err.message });
    if (err.code === 11000) return res.status(409).json({ error: 'That already exists' });
    console.error(err);
    res.status(500).json({ error: 'Something broke on our side. Try again.' });
  });
  return app;
}

export async function start(port = Number(process.env.PORT) || 3000) {
  await connect();
  if (process.env.AUTO_SEED !== '0' && (await User.estimatedDocumentCount()) === 0) {
    console.log('[spillway] empty database, loading demo data');
    await seed();
  }
  const app = createApp();
  const server = createServer(app);
  const io = new Server(server, { serveClient: true });
  await initRealtime(io);
  await new Promise((resolve) => server.listen(port, resolve));
  console.log(`[spillway] http://localhost:${server.address().port}`);
  return { server, io };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
