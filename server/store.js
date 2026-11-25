import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;
export const isValidId = (id) => typeof id === 'string' && ID_RE.test(id);

const MEDIA_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.mp4', '.webm', '.mov', '.m4v', '.ogv']);
export const isAllowedMedia = (name) => MEDIA_EXT.has(path.extname(name).toLowerCase());
export const mediaKind = (name) => (/\.(mp4|webm|mov|m4v|ogv)$/i.test(name) ? 'video' : 'image');

export function safeMediaName(original) {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, path.extname(original))
    .normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'media';
  return `${base}-${Date.now().toString(36)}${ext}`;
}

/** Tiny JSON-file store. Writes are atomic (tmp + rename) and debounced per file. */
export class Store {
  constructor(dir) {
    this.dir = dir;
    this.paths = {
      displays: path.join(dir, 'displays'),
      scenes: path.join(dir, 'scenes'),
      effects: path.join(dir, 'effects'),
      media: path.join(dir, 'media'),
      registry: path.join(dir, 'registry.json'),
    };
    for (const p of [dir, this.paths.displays, this.paths.scenes, this.paths.effects, this.paths.media]) fs.mkdirSync(p, { recursive: true });
    this.pending = new Map();
    this.registry = this.#read(this.paths.registry, { displays: {}, playlists: {} });
    this.registry.displays ||= {};
    this.registry.playlists ||= {};
    this.stateCache = new Map();
  }

  #read(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
  }

  #writeNow(file, data) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, file);
  }

  #writeLater(file, getData, ms = 500) {
    clearTimeout(this.pending.get(file)?.timer);
    const timer = setTimeout(() => {
      this.pending.delete(file);
      try { this.#writeNow(file, getData()); } catch (e) { console.error('[store] write failed', file, e.message); }
    }, ms);
    this.pending.set(file, { timer, getData });
  }

  flush() {
    for (const [file, { timer, getData }] of this.pending) {
      clearTimeout(timer);
      try { this.#writeNow(file, getData()); } catch (e) { console.error('[store] flush failed', file, e.message); }
    }
    this.pending.clear();
  }

  saveRegistry() { this.#writeLater(this.paths.registry, () => this.registry, 300); }

  // ---- displays ----
  upsertDisplay(id, info) {
    this.registry.displays[id] = { ...(this.registry.displays[id] || {}), ...info, id };
    this.saveRegistry();
    return this.registry.displays[id];
  }
  forgetDisplay(id) {
    delete this.registry.displays[id];
    delete this.registry.playlists[id];
    this.stateCache.delete(id);
    fsp.rm(path.join(this.paths.displays, `${id}.json`), { force: true }).catch(() => {});
    this.saveRegistry();
  }
  getDisplayState(id) {
    if (!isValidId(id)) return null;
    if (this.stateCache.has(id)) return this.stateCache.get(id);
    const s = this.#read(path.join(this.paths.displays, `${id}.json`), null);
    this.stateCache.set(id, s);
    return s;
  }
  setDisplayState(id, state) {
    if (!isValidId(id)) return;
    this.stateCache.set(id, state);
    this.#writeLater(path.join(this.paths.displays, `${id}.json`), () => this.stateCache.get(id));
  }

  // ---- playlists (ambient auto-rotation) ----
  getPlaylist(id) { return this.registry.playlists[id] || { enabled: false, sceneIds: [], intervalSec: 300, shuffle: false, index: 0 }; }
  setPlaylist(id, pl) { this.registry.playlists[id] = pl; this.saveRegistry(); }

  // ---- scenes ----
  async listScenes() {
    const files = (await fsp.readdir(this.paths.scenes)).filter((f) => f.endsWith('.json'));
    const out = [];
    for (const f of files) {
      const s = this.#read(path.join(this.paths.scenes, f), null);
      if (s) out.push({ id: s.id, name: s.name, updatedAt: s.updatedAt, surfaces: s.surfaces?.length || 0, effect: s.surfaces?.[0]?.effect, particles: s.surfaces?.[0]?.particles?.mode });
    }
    return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  getScene(id) { return isValidId(id) ? this.#read(path.join(this.paths.scenes, `${id}.json`), null) : null; }
  saveScene(id, scene) {
    const data = { ...scene, id, updatedAt: Date.now() };
    this.#writeNow(path.join(this.paths.scenes, `${id}.json`), data);
    return data;
  }
  async deleteScene(id) { await fsp.rm(path.join(this.paths.scenes, `${id}.json`), { force: true }); }

  // ---- custom effects (user-written shaders) ----
  async listEffects() {
    const files = (await fsp.readdir(this.paths.effects)).filter((f) => f.endsWith('.json'));
    const out = [];
    for (const f of files) {
      const e = this.#read(path.join(this.paths.effects, f), null);
      if (e) out.push(e);
    }
    return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  saveEffect(id, effect) {
    const data = { ...effect, id, updatedAt: Date.now() };
    this.#writeNow(path.join(this.paths.effects, `${id}.json`), data);
    return data;
  }
  async deleteEffect(id) { await fsp.rm(path.join(this.paths.effects, `${id}.json`), { force: true }); }

  // ---- media ----
  async listMedia() {
    const files = await fsp.readdir(this.paths.media);
    const out = [];
    for (const f of files) {
      if (!isAllowedMedia(f)) continue;
      const st = await fsp.stat(path.join(this.paths.media, f));
      out.push({ name: f, url: `/media/${encodeURIComponent(f)}`, type: mediaKind(f), size: st.size, mtime: st.mtimeMs });
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  }
  mediaPath(name) {
    const base = path.basename(name);
    if (base !== name || !isAllowedMedia(base)) return null;
    return path.join(this.paths.media, base);
  }
}
