// Microphone analyser: produces [level, bass, mid, high] in roughly 0..1.
// Requires a secure context (https:// or localhost).
export class AudioAnalyser {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.data = null;
    this.stream = null;
    this.gain = 1.5;
    this.values = [0, 0, 0, 0];
    this.peaks = [0.2, 0.2, 0.2, 0.2];
  }

  get active() { return !!this.stream; }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia no disponible (usa HTTPS) / requires HTTPS');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    src.connect(this.analyser);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.stream = null; this.ctx = null; this.analyser = null;
  }

  read() {
    if (!this.analyser) return this.values;
    this.analyser.getByteFrequencyData(this.data);
    const hz = this.ctx.sampleRate / 2 / this.data.length;
    const band = (lo, hi) => {
      let s = 0, n = 0;
      for (let i = Math.floor(lo / hz); i <= Math.min(this.data.length - 1, Math.ceil(hi / hz)); i++) { s += this.data[i]; n++; }
      return n ? s / n / 255 : 0;
    };
    const raw = [band(20, 8000), band(20, 150), band(150, 2000), band(2000, 8000)];
    // Adaptive normalisation so quiet rooms and loud parties both react.
    this.values = raw.map((v, i) => {
      this.peaks[i] = Math.max(v, this.peaks[i] * 0.995, 0.05);
      return Math.min(2, Math.pow(v / this.peaks[i], 2) * this.gain);
    });
    return this.values;
  }
}
