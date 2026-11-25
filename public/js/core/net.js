// WebSocket client with automatic reconnection.
export class Connection extends EventTarget {
  constructor(hello) {
    super();
    this.hello = hello;
    this.ws = null;
    this.connected = false;
    this.retry = 0;
    this.queue = [];
    this.closed = false;
    this.connect();
  }

  url() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(this.url());
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.connected = true;
      ws.send(JSON.stringify({ t: 'hello', token: localStorage.getItem('lp.token') || '', ...this.hello() }));
      for (const m of this.queue.splice(0)) ws.send(m);
      this.dispatchEvent(new CustomEvent('status', { detail: { connected: true } }));
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.dispatchEvent(new CustomEvent('message', { detail: msg }));
      this.dispatchEvent(new CustomEvent(`msg:${msg.t}`, { detail: msg }));
    };
    ws.onclose = (e) => {
      this.connected = false;
      this.dispatchEvent(new CustomEvent('status', { detail: { connected: false, code: e.code } }));
      if (e.code === 4001) this.dispatchEvent(new CustomEvent('auth-required'));
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => {};
  }

  send(msg) {
    const data = JSON.stringify(msg);
    if (this.connected && this.ws.readyState === 1) this.ws.send(data);
    else if (msg.t !== 'audio') this.queue.push(data);
  }

  on(type, fn) { this.addEventListener(`msg:${type}`, (e) => fn(e.detail)); }

  close() { this.closed = true; this.ws?.close(); }
}

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = localStorage.getItem('lp.token');
  if (token) headers['x-access-token'] = token;
  if (opts.json !== undefined) { headers['content-type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
