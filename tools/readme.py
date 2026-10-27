"""The README's clip: media/viaje.avif (1840 px, 30 fps), a WebP fallback, and the link button.

    npm run dev                 # in another terminal
    node tools/clip.mjs         # captures the frames of each segment into tools/clip/ (kept between runs)
    python tools/readme.py      # composes them: a fade between segments, each moment's name, the encode

Segments (where, how long, the name shown) are in tools/clip.json. Fonts, palette and the SVG helper
come from the profile README pipeline (E:/Proyectos/ChatGPT/drayzu-perfil/tools/build.py).
"""
import importlib.util, json, os, subprocess

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIP = os.path.join(ROOT, 'tools', 'clip')
MEDIA = os.path.join(ROOT, 'media')
spec = importlib.util.spec_from_file_location('build', r'E:/Proyectos/ChatGPT/drayzu-perfil/tools/build.py')
B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)

FPS = 30
CROSS = 10                       # frames of crossfade between segments
FADE = 14                        # frames of fade from and to the card, so the loop is seamless
AVIF_CRF, AVIF_PRESET = 36, 5
WEBP_W, WEBP_Q = 920, 55
TEAL = (111, 227, 193)
INK = (236, 231, 219)

SEGS = json.load(open(os.path.join(ROOT, 'tools', 'clip.json'), encoding='utf-8'))
TITLE = B.pil_font('serif-italic.woff2', 46)
LABEL = B.pil_font('mono.woff2', 19)


def frames(seg):
    d = os.path.join(CLIP, seg['nombre'])
    return [os.path.join(d, f'{k:04d}.png') for k in range(seg['n'])]


def caption(im, seg, i, alpha):
    """The moment's name, bottom left, in Instrument Serif Italic, with the act's number above it."""
    if alpha <= 0.01:
        return im
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    g = ImageDraw.Draw(layer)
    x, y = 70, im.size[1] - 118
    a = int(255 * alpha)
    g.text((x, y - 34), f'DESTINO  ·  {i + 1:02d}', font=LABEL, fill=TEAL + (int(a * 0.85),))
    g.text((x, y), seg['titulo'], font=TITLE, fill=INK + (a,))
    out = im.convert('RGBA')
    # A soft shade rising from the bottom edge, so the words read on any frame (no visible box).
    w, h = im.size
    grad = Image.linear_gradient('L').resize((w, 300))
    sombra = Image.new('RGBA', (w, 300), (0, 0, 0, 0))
    sombra.putalpha(grad.point(lambda v: int(v * 0.42 * alpha)))
    out.alpha_composite(sombra, (0, h - 300))
    return Image.alpha_composite(out, layer).convert('RGB')


def sequence():
    """Every output frame: each segment, crossfading into the next, with its name fading in and out."""
    card = None
    total = sum(s['n'] for s in SEGS) - CROSS * (len(SEGS) - 1)
    k = 0
    for si, seg in enumerate(SEGS):
        fs = frames(seg)
        start = 0 if si == 0 else CROSS
        for j in range(start, seg['n']):
            im = Image.open(fs[j]).convert('RGB')
            # The name: in after a few frames, out before the crossfade.
            a = min(1, (j - 6) / 10, (seg['n'] - CROSS - j) / 10)
            im = caption(im, seg, si, max(0, a))
            # Crossfade into the next segment over its first CROSS frames.
            if si + 1 < len(SEGS) and j >= seg['n'] - CROSS:
                nxt = SEGS[si + 1]
                t = (j - (seg['n'] - CROSS) + 1) / (CROSS + 1)
                im2 = Image.open(frames(nxt)[j - (seg['n'] - CROSS)]).convert('RGB')
                im = Image.blend(im, im2, t)
            if card is None:
                card = Image.new('RGB', im.size, B.CARD['card'])
            f = min(k / FADE, (total - 1 - k) / FADE, 1)
            if f < 1:
                im = Image.blend(card, im, max(f, 0) ** 1.5)
            yield im
            k += 1


def encode():
    os.makedirs(MEDIA, exist_ok=True)
    w, h = Image.open(frames(SEGS[0])[0]).size
    dst = os.path.join(MEDIA, 'viaje.avif')
    ff = subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(FPS), '-i', '-',
         '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
         '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv',
         '-c:v', 'libsvtav1', '-preset', str(AVIF_PRESET), '-crf', str(AVIF_CRF), '-g', '600', '-loop', '0', dst],
        stdin=subprocess.PIPE)
    small = []
    n = 0
    for k, im in enumerate(sequence()):
        ff.stdin.write(im.tobytes())
        if k % 2 == 0:
            small.append(im.resize((WEBP_W, round(h * WEBP_W / w)), Image.LANCZOS))
        n += 1
    ff.stdin.close(); ff.wait()
    print(f'  viaje.avif  {os.path.getsize(dst) / 1e6:.2f} MB  ({w}x{h}, {n} frames, {n / FPS:.1f} s)')
    fb = os.path.join(MEDIA, 'viaje.webp')
    small[0].save(fb, save_all=True, append_images=small[1:], duration=round(2000 / FPS), loop=0, quality=WEBP_Q, method=4)
    print(f'  viaje.webp  {os.path.getsize(fb) / 1e6:.2f} MB')


def link(t):
    """The button: «Destino · coming soon» until the site is published (then it links)."""
    ink, c = t['ink'], t['civ']
    body = (f'<rect x="20" y="16" width="560" height="60" rx="30" fill="{t["panel"]}" stroke="{ink}" stroke-opacity=".3"/>'
            f'<circle cx="54" cy="46" r="6" fill="{c}"/>'
            f'<text x="76" y="56" font-family="S,serif" font-size="28" fill="{ink}">Destino</text>'
            f'<text x="536" y="51" text-anchor="end" font-family="M,monospace" font-size="13" letter-spacing="2" fill="{ink}" fill-opacity=".6">SOON</text>')
    return B.svg(600, 92, 'Destino, coming soon', '', body)


if __name__ == '__main__':
    encode()
    for th, t in B.THEMES.items():
        open(os.path.join(MEDIA, f'link-{th}.svg'), 'w', encoding='utf-8', newline='\n').write(link(t))
    print('  link-dark.svg, link-light.svg')
