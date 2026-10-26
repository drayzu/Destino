/**
 * Sound (optional, off at the start, made in the browser): the power can be heard. A low bed whose
 * density grows with log P (a few deep voices today, more and brighter as the civilization grows),
 * a wind that rises with the pace of the scroll, and a soft bell on each named moment. The silence
 * of Fermi is real silence. Ambient, never music. Phase 5 gives each work its own signature.
 */
export function crearSonido() {
  let ctx: AudioContext | null = null;
  let on = false;
  let master: GainNode;
  let voces: { osc: OscillatorNode; g: GainNode; base: number }[] = [];
  let viento: GainNode;
  let filtro: BiquadFilterNode;

  function iniciar() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // The bed: a fifth stack, each voice entering as the power grows.
    const bases = [55, 82.5, 110, 165, 220, 330];
    voces = bases.map((base) => {
      const osc = ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base;
      const g = ctx!.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(master);
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
    /** Per frame: the power (log10 W), the scroll's pace (beats/s) and how silent the moment is (0..1). */
    update(lp: number, pace: number, silencio: number) {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      const dens = Math.max(0, Math.min(1, (lp - 10) / 30));
      voces.forEach((v, i) => {
        const enter = Math.max(0, Math.min(1, dens * voces.length - i + 0.6));
        v.g.gain.setTargetAtTime(0.05 * enter * (1 - silencio), t, 0.8);
        v.osc.frequency.setTargetAtTime(v.base * (1 + 0.004 * Math.sin(t * 0.3 + i)), t, 0.5);
      });
      viento.gain.setTargetAtTime(Math.min(0.12, 0.02 + Math.abs(pace) * 0.04) * (1 - 0.7 * silencio), t, 0.3);
      filtro.frequency.setTargetAtTime(300 + Math.min(2000, Math.abs(pace) * 600), t, 0.3);
    },
  };
}
