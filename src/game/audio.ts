/* Процедурный WebAudio-звук: короткие блипы, шумовые удары, эмбиент-дрон. */

type OscType = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneNodes: AudioNode[] = [];
  muted = false;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.34;
      this.master.connect(this.ctx.destination);
    } catch {
      return null;
    }
    return this.ctx;
  }

  unlock() {
    const c = this.ensure();
    if (c && c.state === "suspended") void c.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.34, this.ctx.currentTime, 0.05);
    }
  }

  private tone(freq: number, dur: number, type: OscType, vol: number, slideTo?: number, delay = 0) {
    const c = this.ensure();
    if (!c || !this.master || this.muted) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = "bandpass", delay = 0) {
    const c = this.ensure();
    if (!c || !this.master || this.muted) return;
    const t0 = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    f.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  click() { this.tone(640, 0.07, "square", 0.16, 420); }
  hover() { this.tone(880, 0.04, "square", 0.05); }
  swing() { this.noise(0.09, 0.22, 1400); }
  bolt() { this.tone(720, 0.14, "sawtooth", 0.12, 1500); this.noise(0.06, 0.08, 3200, "highpass"); }
  hitEnemy() { this.noise(0.08, 0.3, 500, "lowpass"); this.tone(180, 0.09, "square", 0.16, 90); }
  crit() { this.tone(1200, 0.12, "square", 0.2, 1800); this.noise(0.1, 0.24, 900); }
  hurt() { this.tone(220, 0.22, "sawtooth", 0.24, 70); this.noise(0.14, 0.2, 300, "lowpass"); }
  shield() { this.tone(340, 0.12, "triangle", 0.16, 220); }
  coin() { this.tone(1320, 0.06, "sine", 0.14); this.tone(1760, 0.09, "sine", 0.12, undefined, 0.055); }
  soul() { this.tone(1560, 0.16, "sine", 0.09, 2100); }
  chest() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, "square", 0.12, undefined, i * 0.07)); }
  potion() { this.tone(300, 0.18, "sine", 0.18, 620); this.tone(500, 0.12, "sine", 0.1, 900, 0.12); }
  levelup() { [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, "square", 0.13, undefined, i * 0.08)); }
  stairs() { this.tone(300, 0.4, "sawtooth", 0.14, 70); this.noise(0.35, 0.1, 250, "lowpass"); }
  death() { [220, 174, 146, 110].forEach((f, i) => this.tone(f, 0.4, "sawtooth", 0.16, f * 0.8, i * 0.22)); }
  victory() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, "square", 0.14, undefined, i * 0.12)); }
  roar() { this.tone(65, 0.7, "sawtooth", 0.3, 40); this.noise(0.5, 0.24, 180, "lowpass"); }
  summon() { this.tone(200, 0.5, "sine", 0.12, 900); }
  teleport() { this.tone(1400, 0.22, "sine", 0.1, 300); this.noise(0.12, 0.08, 4000, "highpass"); }
  buy() { this.tone(980, 0.07, "square", 0.14); this.tone(1470, 0.1, "square", 0.12, undefined, 0.06); }
  error() { this.tone(140, 0.16, "square", 0.16, 90); }
  barrel() { this.noise(0.2, 0.3, 220, "lowpass"); this.tone(90, 0.18, "square", 0.18, 50); }
  trap() { this.noise(0.12, 0.26, 2400, "highpass"); this.tone(180, 0.1, "square", 0.14, 90); }
  arrow() { this.noise(0.07, 0.14, 2600, "highpass"); }
  split() { this.tone(500, 0.12, "sine", 0.14, 260); this.tone(620, 0.1, "sine", 0.1, 320, 0.06); }

  startDrone() {
    const c = this.ensure();
    if (!c || !this.master || this.droneNodes.length) return;
    const g = c.createGain();
    g.gain.value = 0.05;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 240;
    const o1 = c.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.value = 55;
    const o2 = c.createOscillator();
    o2.type = "sawtooth";
    o2.frequency.value = 82.6;
    o2.detune.value = 7;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoG = c.createGain();
    lfoG.gain.value = 60;
    lfo.connect(lfoG).connect(f.frequency);
    o1.connect(f);
    o2.connect(f);
    f.connect(g).connect(this.master);
    o1.start(); o2.start(); lfo.start();
    this.droneNodes = [o1, o2, lfo, g, f, lfoG];
  }

  stopDrone() {
    for (const n of this.droneNodes) {
      try {
        if (n instanceof OscillatorNode) n.stop();
        n.disconnect();
      } catch { /* ignore */ }
    }
    this.droneNodes = [];
  }

  destroy() {
    this.stopDrone();
    if (this.ctx) void this.ctx.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
  }
}
