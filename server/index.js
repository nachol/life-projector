import express from 'express';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import selfsigned from 'selfsigned';
import { Store, isValidId, isAllowedMedia, safeMediaName, mediaKind } from './store.js';
import { Hub } from './hub.js';
import { PRESET_SCENES, sanitizeCustomEffect } from '../public/js/core/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const cfg = {
  name: process.env.SERVER_NAME || 'Life Projector',
  version: pkg.version,
  port: Number(process.env.PORT || 8080),
  httpsPort: Number(process.env.HTTPS_PORT ?? 8443),
  dataDir: path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data')),
  token: process.env.ACCESS_TOKEN || '',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 1024) * 1024 * 1024,
  mdns: (process.env.MDNS || 'true').toLowerCase() !== 'false',
};

const store = new Store(cfg.dataDir);
const hub = new Hub(store, cfg);
const app = express();
app.disable('x-powered-by');

// ---------- helpers ----------
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function requireToken(req, res, next) {
  if (!cfg.token) return next();
  const t = req.get('x-access-token') || req.query.token;
  if (t === cfg.token) return next();
  res.status(401).json({ error: 'unauthorized' });
}

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- static ----------
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.static(path.join(ROOT, 'public'), {
  extensions: ['html'],
  setHeaders(res, file) {
    if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) res.set('Cache-Control', 'no-cache');
  },
}));
app.use('/media', express.static(store.paths.media, { maxAge: '1h', acceptRanges: true }));

// ---------- API ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/info', (req, res) => {
  res.json({
    name: cfg.name, version: cfg.version, needsToken: !!cfg.token,
    httpPort: cfg.port, httpsPort: cfg.httpsPort || null, addresses: lanAddresses(),
    publicUrl: process.env.PUBLIC_URL || null,
  });
});

app.get('/api/qr', asyncRoute(async (req, res) => {
  const text = String(req.query.text || '').slice(0, 500);
  if (!text) return res.status(400).end();
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#ffffff', light: '#00000000' } });
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(svg);
}));

app.use('/api', requireToken);

app.get('/api/displays', (req, res) => res.json(hub.displayList()));
app.get('/api/displays/:id/state', (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).end();
  res.json(store.getDisplayState(req.params.id));
});

app.get('/api/scenes', asyncRoute(async (req, res) => {
  res.json({
    presets: PRESET_SCENES.map((s) => ({ id: s.id, name: s.name, builtIn: true, effect: s.surfaces[0]?.effect, particles: s.surfaces[0]?.particles?.mode })),
    user: await store.listScenes(),
  });
}));
app.get('/api/scenes/:id', (req, res) => {
  const preset = PRESET_SCENES.find((s) => s.id === req.params.id);
  const scene = preset || store.getScene(req.params.id);
  if (!scene) return res.status(404).json({ error: 'not found' });
  res.json(scene);
});
app.put('/api/scenes/:id', express.json({ limit: '4mb' }), (req, res) => {
  const { id } = req.params;
  if (!isValidId(id) || id.startsWith('preset-')) return res.status(400).json({ error: 'bad id' });
  const body = req.body || {};
  if (!Array.isArray(body.surfaces)) return res.status(400).json({ error: 'surfaces required' });
  const saved = store.saveScene(id, {
    name: String(body.name || 'Escena').slice(0, 80),
    surfaces: body.surfaces, masks: Array.isArray(body.masks) ? body.masks : [], audio: body.audio,
  });
  res.json(saved);
});
app.delete('/api/scenes/:id', asyncRoute(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).end();
  await store.deleteScene(req.params.id);
  res.json({ ok: true });
}));

// Custom effects library (user-written GLSL). The shader itself is also embedded in each
// surface that uses it, so displays never need to fetch this.
app.get('/api/effects', asyncRoute(async (req, res) => res.json(await store.listEffects())));
app.put('/api/effects/:id', express.json({ limit: '256kb' }), (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'bad id' });
  const fx = sanitizeCustomEffect({ ...(req.body || {}), id });
  if (!fx) return res.status(400).json({ error: 'invalid effect' });
  const thumb = typeof req.body?.thumb === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(req.body.thumb) && req.body.thumb.length < 150000
    ? req.body.thumb : null;
  res.json(store.saveEffect(id, { ...fx, thumb }));
});
app.delete('/api/effects/:id', asyncRoute(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).end();
  await store.deleteEffect(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/media', asyncRoute(async (req, res) => res.json(await store.listMedia())));
// Raw upload: body is the file, original name in X-Filename (avoids a multipart dependency).
app.post('/api/media', asyncRoute(async (req, res) => {
  const original = decodeURIComponent(req.get('x-filename') || '');
  if (!original || !isAllowedMedia(original)) return res.status(400).json({ error: 'unsupported file type' });
  const len = Number(req.get('content-length') || 0);
  if (len > cfg.maxUploadBytes) return res.status(413).json({ error: 'file too large' });
  const name = safeMediaName(original);
  const dest = store.mediaPath(name);
  let received = 0;
  req.on('data', (c) => {
    received += c.length;
    if (received > cfg.maxUploadBytes) req.destroy(new Error('too large'));
  });
  try {
    await pipeline(req, fs.createWriteStream(dest));
  } catch (e) {
    fs.rmSync(dest, { force: true });
    return res.status(413).json({ error: 'upload failed' });
  }
  res.json({ name, url: `/media/${encodeURIComponent(name)}`, type: mediaKind(name) });
}));
app.delete('/api/media/:name', asyncRoute(async (req, res) => {
  const p = store.mediaPath(req.params.name);
  if (!p) return res.status(400).end();
  fs.rmSync(p, { force: true });
  res.json({ ok: true });
}));

app.use((err, req, res, next) => {
  console.error('[http]', err);
  res.status(500).json({ error: 'internal error' });
});

// ---------- servers ----------
const wssHttp = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
hub.attach(wssHttp);

function bindUpgrade(server) {
  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/ws')) return socket.destroy();
    wssHttp.handleUpgrade(req, socket, head, (ws) => wssHttp.emit('connection', ws, req));
  });
}

async function loadCert() {
  const dir = path.join(cfg.dataDir, 'certs');
  const keyFile = path.join(dir, 'key.pem');
  const certFile = path.join(dir, 'cert.pem');
  if (process.env.TLS_KEY && process.env.TLS_CERT) {
    return { key: fs.readFileSync(process.env.TLS_KEY), cert: fs.readFileSync(process.env.TLS_CERT) };
  }
  if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  }
  fs.mkdirSync(dir, { recursive: true });
  const altNames = [{ type: 2, value: 'localhost' }, { type: 2, value: 'life-projector.local' }, { type: 7, ip: '127.0.0.1' }]
    .concat(lanAddresses().map((ip) => ({ type: 7, ip })));
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'life-projector.local' }], {
    keySize: 2048, algorithm: 'sha256',
    notAfterDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3650),
    extensions: [{ name: 'subjectAltName', altNames }],
  });
  fs.writeFileSync(keyFile, pems.private, { mode: 0o600 });
  fs.writeFileSync(certFile, pems.cert);
  console.log('[https] generated self-signed certificate in', dir);
  return { key: pems.private, cert: pems.cert };
}

const httpServer = http.createServer(app);
bindUpgrade(httpServer);
httpServer.listen(cfg.port, () => {
  console.log(`\n  ✨ ${cfg.name} v${cfg.version}`);
  console.log(`  Controller: http://localhost:${cfg.port}/`);
  console.log(`  Display:    http://localhost:${cfg.port}/display`);
  for (const ip of lanAddresses()) console.log(`  LAN:        http://${ip}:${cfg.port}/`);
  if (cfg.token) console.log('  Access token required (ACCESS_TOKEN is set)');
  console.log(`  Data dir:   ${cfg.dataDir}\n`);
});

if (cfg.httpsPort) {
  loadCert().then((tls) => {
    const httpsServer = https.createServer(tls, app);
    bindUpgrade(httpsServer);
    httpsServer.listen(cfg.httpsPort, () => console.log(`  HTTPS (mic, wake-lock, second screen): https://localhost:${cfg.httpsPort}/`));
  }).catch((e) => console.error('[https] disabled:', e.message));
}

let bonjour = null;
if (cfg.mdns) {
  import('bonjour-service').then(({ Bonjour }) => {
    bonjour = new Bonjour();
    bonjour.publish({ name: `${cfg.name} ${os.hostname()}`.slice(0, 60), type: 'lifeprojector', port: cfg.port, txt: { path: '/display', v: cfg.version } });
    bonjour.publish({ name: `${cfg.name} web ${os.hostname()}`.slice(0, 60), type: 'http', port: cfg.port, txt: { path: '/' } });
    console.log('  mDNS: advertising _lifeprojector._tcp');
  }).catch((e) => console.warn('[mdns] disabled:', e.message));
}

function shutdown() {
  console.log('\nShutting down…');
  store.flush();
  try { bonjour?.unpublishAll(() => bonjour.destroy()); } catch {}
  httpServer.close();
  setTimeout(() => process.exit(0), 300).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
