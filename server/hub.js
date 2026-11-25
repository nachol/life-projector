import { isValidId } from './store.js';
import { applyScene, normalizeState, PRESET_SCENES } from '../public/js/core/catalog.js';

const MAX_MSG = 2 * 1024 * 1024;

/**
 * Real-time hub. Two roles connect over WebSocket:
 *  - display:    a screen / projector / Google TV that renders the show
 *  - controller: a phone or computer that edits what a display shows
 * Every display owns its state (surfaces, masks, optics). Controllers subscribe to one
 * display at a time; edits are persisted and relayed to the display and the other controllers.
 */
export class Hub {
  constructor(store, cfg) {
    this.store = store;
    this.cfg = cfg;
    this.displays = new Map(); // displayId -> Set<ws>
    this.controllers = new Set();
    this.live = new Map(); // displayId -> { fps, w, h, renderScale }
    this.playlistClock = new Map(); // displayId -> last switch timestamp
    this.listTimer = null;
  }

  attach(wss) {
    wss.on('connection', (ws, req) => {
      ws.isAlive = true;
      ws.role = null;
      ws.ip = req.socket.remoteAddress;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (buf, isBinary) => {
        if (isBinary || buf.length > MAX_MSG) return;
        let msg;
        try { msg = JSON.parse(buf.toString()); } catch { return; }
        try { this.handle(ws, msg); } catch (e) { console.error('[hub] error handling', msg?.t, e); }
      });
      ws.on('close', () => this.drop(ws));
      ws.on('error', () => {});
    });
    const ping = setInterval(() => {
      for (const ws of wss.clients) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        try { ws.ping(); } catch {}
      }
    }, 15000);
    const sched = setInterval(() => this.tickPlaylists(), 5000);
    wss.on('close', () => { clearInterval(ping); clearInterval(sched); });
  }

  send(ws, msg) {
    if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  toDisplay(id, msg) {
    const set = this.displays.get(id);
    if (!set) return;
    const data = JSON.stringify(msg);
    for (const ws of set) this.send(ws, data);
  }

  toControllers(msg, { displayId, except } = {}) {
    const data = JSON.stringify(msg);
    for (const ws of this.controllers) {
      if (ws === except) continue;
      if (displayId && ws.subscribed !== displayId) continue;
      this.send(ws, data);
    }
  }

  displayList() {
    const list = Object.values(this.store.registry.displays).map((d) => {
      const live = this.live.get(d.id) || {};
      const st = this.store.getDisplayState(d.id);
      return {
        id: d.id, name: d.name, ua: d.ua, lastSeen: d.lastSeen,
        online: this.displays.has(d.id),
        w: live.w || d.w, h: live.h || d.h, fps: live.fps || 0, renderScale: live.renderScale,
        sceneName: st?.sceneName || null,
        playlist: this.store.getPlaylist(d.id).enabled,
      };
    });
    return list.sort((a, b) => (b.online - a.online) || String(a.name).localeCompare(String(b.name)));
  }

  broadcastDisplays() {
    clearTimeout(this.listTimer);
    this.listTimer = setTimeout(() => this.toControllers({ t: 'displays', list: this.displayList() }), 100);
  }

  authorized(msg) {
    return !this.cfg.token || msg.token === this.cfg.token;
  }

  handle(ws, msg) {
    if (msg.t === 'hello') {
      if (!this.authorized(msg)) {
        this.send(ws, { t: 'error', code: 'auth', message: 'Invalid access token' });
        ws.close(4001, 'auth');
        return;
      }
      if (msg.role === 'display') return this.helloDisplay(ws, msg);
      if (msg.role === 'controller') return this.helloController(ws);
      return;
    }
    if (!ws.role) return;
    if (ws.role === 'display') return this.fromDisplay(ws, msg);
    return this.fromController(ws, msg);
  }

  helloDisplay(ws, msg) {
    const id = isValidId(msg.id) ? msg.id : null;
    if (!id) return ws.close(4002, 'bad id');
    ws.role = 'display';
    ws.displayId = id;
    if (!this.displays.has(id)) this.displays.set(id, new Set());
    this.displays.get(id).add(ws);
    const prev = this.store.registry.displays[id];
    const name = String(prev?.name || msg.name || `Display ${id.slice(-4)}`).slice(0, 60);
    this.store.upsertDisplay(id, { name, ua: String(msg.ua || '').slice(0, 120), w: msg.w, h: msg.h, lastSeen: Date.now() });
    this.live.set(id, { w: msg.w, h: msg.h, fps: 0 });
    this.send(ws, { t: 'welcome', role: 'display', name, server: this.cfg.name, now: Date.now() });
    this.send(ws, { t: 'state', displayId: id, state: this.store.getDisplayState(id) });
    console.log(`[hub] display online: ${name} (${id}) from ${ws.ip}`);
    this.broadcastDisplays();
  }

  helloController(ws) {
    ws.role = 'controller';
    this.controllers.add(ws);
    this.send(ws, { t: 'welcome', role: 'controller', server: this.cfg.name, now: Date.now() });
    this.send(ws, { t: 'displays', list: this.displayList() });
  }

  fromDisplay(ws, msg) {
    const id = ws.displayId;
    switch (msg.t) {
      case 'init-state': {
        if (!this.store.getDisplayState(id) && msg.state) {
          const state = normalizeState(msg.state);
          this.store.setDisplayState(id, state);
          this.toControllers({ t: 'state', displayId: id, state }, { displayId: id });
        }
        break;
      }
      case 'stats': {
        const shaderErrors = Array.isArray(msg.shaderErrors) ? msg.shaderErrors.slice(0, 10).map((e) => ({
          id: String(e?.id || '').slice(0, 80), name: String(e?.name || '').slice(0, 60),
          errors: (Array.isArray(e?.errors) ? e.errors : []).slice(0, 5).map((x) => ({ line: Number.isInteger(x?.line) ? x.line : null, message: String(x?.message || '').slice(0, 300) })),
        })) : [];
        const live = { fps: Math.round(msg.fps || 0), w: msg.w, h: msg.h, renderScale: msg.renderScale, shaderErrors };
        this.live.set(id, live);
        this.toControllers({ t: 'stats', displayId: id, ...live });
        break;
      }
    }
  }

  fromController(ws, msg) {
    const id = msg.displayId;
    if (id !== undefined && !isValidId(id)) return;
    switch (msg.t) {
      case 'subscribe': {
        ws.subscribed = id;
        let state = this.store.getDisplayState(id);
        this.send(ws, { t: 'state', displayId: id, state });
        this.send(ws, { t: 'playlist', displayId: id, playlist: this.store.getPlaylist(id) });
        break;
      }
      case 'state': {
        if (!msg.state || typeof msg.state !== 'object') return;
        this.store.setDisplayState(id, msg.state);
        this.toDisplay(id, { t: 'state', displayId: id, state: msg.state });
        this.toControllers({ t: 'state', displayId: id, state: msg.state }, { displayId: id, except: ws });
        break;
      }
      case 'apply-scene': {
        const ids = Array.isArray(msg.displayIds) ? msg.displayIds.filter(isValidId) : [id];
        const sceneDef = this.findScene(msg.sceneId);
        if (!sceneDef) return this.send(ws, { t: 'error', message: 'Scene not found' });
        for (const did of ids) this.applySceneTo(did, sceneDef, msg.mode === 'full' ? 'full' : 'content');
        break;
      }
      case 'audio': {
        this.toDisplay(id, { t: 'audio', v: msg.v });
        break;
      }
      case 'cmd': {
        this.toDisplay(id, { t: 'cmd', cmd: String(msg.cmd), value: msg.value });
        break;
      }
      case 'rename': {
        const name = String(msg.name || '').trim().slice(0, 60);
        if (!name || !this.store.registry.displays[id]) return;
        this.store.upsertDisplay(id, { name });
        this.toDisplay(id, { t: 'cmd', cmd: 'rename', value: name });
        this.broadcastDisplays();
        break;
      }
      case 'forget': {
        if (this.displays.has(id)) return this.send(ws, { t: 'error', message: 'Display is online' });
        this.store.forgetDisplay(id);
        this.broadcastDisplays();
        break;
      }
      case 'playlist': {
        const p = msg.playlist || {};
        const pl = {
          enabled: !!p.enabled,
          sceneIds: (Array.isArray(p.sceneIds) ? p.sceneIds : []).filter(isValidId).slice(0, 100),
          intervalSec: Math.max(10, Math.min(24 * 3600, Number(p.intervalSec) || 300)),
          shuffle: !!p.shuffle,
          mode: p.mode === 'full' ? 'full' : 'content',
          index: 0,
        };
        this.store.setPlaylist(id, pl);
        this.playlistClock.set(id, Date.now());
        this.toControllers({ t: 'playlist', displayId: id, playlist: pl }, { displayId: id });
        this.broadcastDisplays();
        break;
      }
    }
  }

  findScene(sceneId) {
    return PRESET_SCENES.find((s) => s.id === sceneId) || this.store.getScene(sceneId);
  }

  applySceneTo(displayId, sceneDef, mode) {
    const current = normalizeState(this.store.getDisplayState(displayId));
    const next = applyScene(current, sceneDef, mode);
    this.store.setDisplayState(displayId, next);
    this.toDisplay(displayId, { t: 'state', displayId, state: next });
    this.toControllers({ t: 'state', displayId, state: next }, { displayId });
    this.broadcastDisplays();
  }

  tickPlaylists() {
    const now = Date.now();
    for (const [id, pl] of Object.entries(this.store.registry.playlists)) {
      if (!pl.enabled || !pl.sceneIds?.length) continue;
      const last = this.playlistClock.get(id);
      if (last === undefined) { this.playlistClock.set(id, now); continue; }
      if (now - last < pl.intervalSec * 1000) continue;
      this.playlistClock.set(id, now);
      let index;
      if (pl.shuffle && pl.sceneIds.length > 1) {
        do { index = Math.floor(Math.random() * pl.sceneIds.length); } while (index === pl.index);
      } else {
        index = ((pl.index || 0) + 1) % pl.sceneIds.length;
      }
      pl.index = index;
      this.store.saveRegistry();
      const sceneDef = this.findScene(pl.sceneIds[index]);
      if (sceneDef) this.applySceneTo(id, sceneDef, pl.mode || 'content');
    }
  }

  drop(ws) {
    if (ws.role === 'display') {
      const set = this.displays.get(ws.displayId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          this.displays.delete(ws.displayId);
          this.store.upsertDisplay(ws.displayId, { lastSeen: Date.now() });
          console.log(`[hub] display offline: ${ws.displayId}`);
        }
      }
      this.broadcastDisplays();
    } else if (ws.role === 'controller') {
      this.controllers.delete(ws);
    }
  }
}
