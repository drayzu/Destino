/**
 * Contact sheets of the journey (debug only): the film and its plate at many beats in one image, so
 * the whole journey can be reviewed at a glance; each frame is drawn by hand (no waiting for
 * requestAnimationFrame, which does not run in a hidden pane). With a path, the sheet is saved into
 * the project (dev only, through the `/__guardar` plugin in vite.config.ts).
 */

export interface SheetHost {
  freeze(beat: number | null): void;
  held(): number | null;
  step(now: number): void;
  canvases: HTMLCanvasElement[];
  labelOf(beat: number): string;
  /** Resolves when everything the world loads has arrived. */
  listo: Promise<unknown>;
}

async function guardar(c: HTMLCanvasElement, path: string, q = 0.88) {
  const blob = await new Promise<Blob>((res) => c.toBlob((bb) => res(bb!), 'image/jpeg', q));
  await fetch(`/__guardar?f=${encodeURIComponent(path)}`, { method: 'POST', body: blob });
  return path;
}

export function contactos(host: SheetHost) {
  /** Renders beat `b` (after a few simulated frames, so ambient motion settles) into a new canvas. */
  async function cuadro(b: number, warm = 24) {
    await host.listo;
    await document.fonts?.ready;
    host.freeze(b);
    const t0 = performance.now();
    for (let i = 0; i < warm; i++) host.step(t0 + i * 16.7);
    const [film] = host.canvases;
    const out = document.createElement('canvas');
    out.width = film.width;
    out.height = film.height;
    const g = out.getContext('2d')!;
    for (const c of host.canvases) g.drawImage(c, 0, 0, out.width, out.height);
    return out;
  }

  return {
    /** One frame at beat b: `destino.foto('docs/fase1/x.jpg', 12)`. */
    async foto(path: string, b: number) {
      const before = host.held();
      const c = await cuadro(b);
      host.freeze(before);
      return guardar(c, path, 0.92);
    },
    /** A sheet of beats in `cols` columns, `width` px wide: `destino.hoja('docs/fase1/viaje.jpg', [0, 2, 4], 4, 2400)`. */
    async hoja(path: string, beats: number[], cols = 4, width = 2400) {
      const before = host.held();
      const [film] = host.canvases;
      const tw = Math.floor(width / cols);
      const th = Math.round((tw * film.height) / film.width);
      const out = document.createElement('canvas');
      out.width = cols * tw;
      out.height = Math.ceil(beats.length / cols) * th;
      const g = out.getContext('2d')!;
      g.fillStyle = '#000';
      g.fillRect(0, 0, out.width, out.height);
      for (const [k, b] of beats.entries()) {
        const c = await cuadro(b);
        const x = (k % cols) * tw;
        const y = Math.floor(k / cols) * th;
        g.drawImage(c, x, y, tw, th);
        const s = tw / 640;
        g.font = `500 ${Math.round(13 * s)}px "Geist Mono Variable", monospace`;
        const label = `${b.toFixed(1)} ${host.labelOf(b)}`;
        const w = g.measureText(label).width;
        g.fillStyle = 'rgba(0,0,0,0.62)';
        g.fillRect(x + 8 * s, y + 8 * s, w + 16 * s, 24 * s);
        g.fillStyle = '#ece7db';
        g.textBaseline = 'middle';
        g.fillText(label, x + 16 * s, y + 20.5 * s);
      }
      host.freeze(before);
      return guardar(out, path);
    },
  };
}
