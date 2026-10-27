/**
 * Sound (optional, off at the start, made in the browser): the power can be heard. A low bed whose
 * density grows with log P (a few deep voices today, more and brighter as the civilization grows),
 * a wind that rises with the pace of the scroll, and a soft bell on each named moment. The silence
 * of Fermi is real silence. Ambient, never music.
 *
 * Each act has its signature, gliding from one to the next: the bed is transposed (lower as the
 * journey goes out and on), and one trait of its own is added: a slow pulse like a heartbeat while
 * matter wakes (I), the hum of the grid today (II), a brighter shimmer among the stars, its pitch
 * raised by the sail's speed (IV), the ticks of thought as bits (VI), a slow fading pulse at the end.
 */

interface Firma {
  /** The bed's transposition. */
  tono: number;
  /** A pulse on the bed (its rate, Hz) and how deep. */
  pulso: number;
  hondo: number;
  /** The grid's hum (0..1). */
  zumbido: number;
  /** Ticks of thought (per second). */
  tics: number;
}
const FIRMAS: Firma[] = [
  { tono: 1, pulso: 0.2, hondo: 0.2, zumbido: 0, tics: 0 }, // 0 · listening
  { tono: 0.75, pulso: 1.1, hondo: 0.55, zumbido: 0, tics: 0 }, // I · matter wakes
  { tono: 8 / 9, pulso: 0.2, hondo: 0.1, zumbido: 1, tics: 0 }, // II · today
  { tono: 1, pulso: 0.15, hondo: 0.1, zumbido: 0.15, tics: 0 }, // III · the Solar System
  { tono: 9 / 8, pulso: 0.3, hondo: 0.15, zumbido: 0, tics: 0 }, // IV · neighbouring stars
  { tono: 2 / 3, pulso: 0.08, hondo: 0.25, zumbido: 0, tics: 0 }, // V · the galaxy
  { tono: 0.8, pulso: 0.5, hondo: 0.2, zumbido: 0, tics: 5 }, // VI · inward
  { tono: 0.5, pulso: 0.06, hondo: 0.3, zumbido: 0, tics: 0.6 }, // VII · the cosmos
  { tono: 0.5, pulso: 0.12, hondo: 0.6, zumbido: 0, tics: 0 }, // VIII · the end
];
export function crearSonido() {
  let ctx: AudioContext | null = null;
  let on = false;
  let master: GainNode;
  let voces: { osc: OscillatorNode; g: GainNode; base: number }[] = [];
  let viento: GainNode;
  let filtro: BiquadFilterNode;
  let lecho: GainNode;
  let lfo: OscillatorNode;
  let lfoHondo: GainNode;
  let zumbido: GainNode;
  let zumbidoOsc: OscillatorNode;
  const firma: Firma = { ...FIRMAS[0] };

  function iniciar() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // The bed goes through a gain a slow oscillator moves: the act's pulse.
    lecho = ctx.createGain();
    lecho.gain.value = 1;
    lecho.connect(master);
    lfo = ctx.createOscillator();
    lfo.frequency.value = 0.2;
    lfoHondo = ctx.createGain();
    lfoHondo.gain.value = 0;
    lfo.connect(lfoHondo).connect(lecho.gain);
    lfo.start();
    // The grid's hum: a soft buzz, low-passed.
    zumbidoOsc = ctx.createOscillator();
    zumbidoOsc.type = 'sawtooth';
    zumbidoOsc.frequency.value = 50;
    const zf = ctx.createBiquadFilter();
    zf.type = 'lowpass';
    zf.frequency.value = 260;
    zumbido = ctx.createGain();
    zumbido.gain.value = 0;
    zumbidoOsc.connect(zf).connect(zumbido).connect(master);
    zumbidoOsc.start();
    // The bed: a fifth stack, each voice entering as the power grows.
    const bases = [55, 82.5, 110, 165, 220, 330];
    voces = bases.map((base) => {
      const osc = ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base;
      const g = ctx!.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(lecho);
      osc.start();
      return { osc, g, base };
    });
    // The wind: filtered noise.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) {
      b = 0.98 * b + 0.02 * (Math.random() * 2 - 1);
      d[i] = b * 3;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 400;
    viento = ctx.createGain();
    viento.gain.value = 0;
    src.connect(filtro).connect(viento).connect(master);
    src.start();
  }

  return {
    get on() {
      return on;
    },
    toggle() {
      if (!ctx) iniciar();
      on = !on;
      void ctx!.resume();
      master.gain.setTargetAtTime(on ? 0.5 : 0, ctx!.currentTime, 0.4);
      return on;
    },
    /** A soft bell when a named moment arrives. */
    campana() {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      for (const [f, a] of [[880, 0.05], [1320, 0.025], [2217, 0.012]] as const) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(a, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 3.3);
      }
    },
    /**
     * Per frame: the power (log10 W), the scroll's pace (beats/s), how silent the moment is (0..1),
     * the act (its index) and the observer's speed (fraction of c).
     */
    update(lp: number, pace: number, silencio: number, acto = 0, beta = 0) {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      // Glide towards the act's signature.
      const meta = FIRMAS[Math.max(0, Math.min(FIRMAS.length - 1, acto))];
      for (const k of Object.keys(firma) as (keyof Firma)[]) firma[k] += (meta[k] - firma[k]) * 0.02;
      // Light ahead is bluer: at speed the bed rises (the sail's Doppler).
      const doppler = Math.sqrt((1 + beta) / Math.max(1e-3, 1 - beta));
      const tono = firma.tono * Math.min(2, doppler);
      lfo.frequency.setTargetAtTime(firma.pulso, t, 0.5);
      lfoHondo.gain.setTargetAtTime(0.5 * firma.hondo, t, 0.5);
      lecho.gain.setTargetAtTime(1 - 0.5 * firma.hondo, t, 0.5);
      zumbido.gain.setTargetAtTime(0.025 * firma.zumbido * (1 - silencio), t, 0.6);
      zumbidoOsc.frequency.setTargetAtTime(50 * (1 + 0.003 * Math.sin(t * 0.7)), t, 0.5);
      // Ticks of thought: short, quiet, at random.
      if (firma.tics > 0.05 && Math.random() < firma.tics / 60) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 1800 + Math.random() * 2400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.008 * (1 - silencio), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 0.05);
      }
      const dens = Math.max(0, Math.min(1, (lp - 10) / 30));
      voces.forEach((v, i) => {
        const enter = Math.max(0, Math.min(1, dens * voces.length - i + 0.6));
        v.g.gain.setTargetAtTime(0.05 * enter * (1 - silencio), t, 0.8);
        v.osc.frequency.setTargetAtTime(v.base * tono * (1 + 0.004 * Math.sin(t * 0.3 + i)), t, 0.5);
      });
      viento.gain.setTargetAtTime(Math.min(0.12, 0.02 + Math.abs(pace) * 0.04) * (1 - 0.7 * silencio), t, 0.3);
      filtro.frequency.setTargetAtTime(300 + Math.min(2000, Math.abs(pace) * 600), t, 0.3);
    },
  };
}
