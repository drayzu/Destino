import { FONT, ink, tr } from './placa';

/**
 * The spectrum seen from afar (energy per log of wavelength, λFλ): the Sun's light at 5 800 K and
 * the collectors' heat at ~300 K have the same shape, shifted; the swarm moves energy from one bump
 * to the other (fraction f), so the visible bump shrinks as much as the infrared one grows.
 */
export function espectro(g: CanvasRenderingContext2D, u: number, x: number, y: number, w: number, h: number, f: number, alpha: number) {
  const L0 = -1;
  const L1 = 2;
  const X = (l: number) => x + ((l - L0) / (L1 - L0)) * w;
  const shape = (lum: number, T: number) => {
    const xx = 14388 / (Math.pow(10, lum) * T);
    return xx > 60 ? 0 : Math.pow(xx, 4) / (Math.exp(xx) - 1) / 4.78;
  };
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = 'rgba(4,6,8,0.7)';
  g.strokeStyle = 'rgba(236,231,219,0.18)';
  g.lineWidth = Math.max(1, u);
  g.beginPath();
  g.roundRect(x - 18 * u, y - 40 * u, w + 36 * u, h + 76 * u, 8 * u);
  g.fill();
  g.stroke();
  g.font = FONT.mono(9.5 * u);
  g.letterSpacing = `${1.3 * u}px`;
  g.fillStyle = ink(0.7);
  g.fillText(tr('espectro visto desde lejos').toUpperCase(), x, y - 20 * u);
  // the visible band
  const v0 = X(Math.log10(0.38));
  const v1 = X(Math.log10(0.75));
  const grd = g.createLinearGradient(v0, 0, v1, 0);
  ['#7a4cff', '#3f7bff', '#2fd0c0', '#9be04a', '#ffd23a', '#ff8a2a', '#ff3a2a'].forEach((c, i, a) => grd.addColorStop(i / (a.length - 1), c));
  g.fillStyle = grd;
  g.globalAlpha = alpha * 0.55;
  g.fillRect(v0, y + h + 2 * u, v1 - v0, 5 * u);
  g.globalAlpha = alpha;
  // axis
  g.strokeStyle = ink(0.4);
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x + w, y + h);
  g.stroke();
  g.fillStyle = ink(0.55);
  g.font = FONT.mono(9 * u);
  g.letterSpacing = '0px';
  g.textAlign = 'center';
  ['0,1', '1', '10', '100'].forEach((t, i) => g.fillText(`${t} µm`, X(L0 + i), y + h + 22 * u));
  g.textAlign = 'left';
  const curve = (T: number, k: number, color: string) => {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, 1.8 * u);
    g.beginPath();
    for (let i = 0; i <= 160; i++) {
      const l = L0 + ((L1 - L0) * i) / 160;
      const yy = y + h - shape(l, T) * k * h;
      if (i) g.lineTo(X(l), yy);
      else g.moveTo(X(l), yy);
    }
    g.stroke();
  };
  curve(5772, 1 - f, '#ffe0a0');
  curve(300, f, '#ff6a3d');
  g.font = FONT.mono(9.5 * u);
  g.fillStyle = '#ffe0a0';
  g.fillText(tr('luz del Sol · 5 800 K'), X(Math.log10(0.65)) + 8 * u, y + h - (1 - f) * h - 6 * u);
  g.fillStyle = '#ff8a5a';
  g.textAlign = 'right';
  g.fillText(tr('calor del enjambre · 300 K'), X(Math.log10(12)) - 8 * u, y + h - f * h - 6 * u);
  g.restore();
}

