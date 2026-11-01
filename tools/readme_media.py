"""The README, as in Espacio and Tiempo: a cover (the title over the hero clip) and six moments, each a
captured clip on one side and its power and caption on the other.

    node tools/clip-viaje.mjs                            (the frames, from the journey itself; dev server on 5211)
    python tools/readme_media.py [cover thought ...]     ->  media/<name>-<theme>.avif / .webp

Drawn at 1840 px wide (about twice the README column, sharp on HiDPI screens), text included, from the
1840 x 1035 JPG frames in tools/readme/<clip>. AVIF at 30 fps for the page; a lighter WebP (920 px,
15 fps) for browsers without AVIF. Each theme is flattened onto GitHub's own background. Clips play back
and forth, or loop forwards with a crossfade when the moment should not run backwards.
"""
import os, subprocess, sys, textwrap
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FR = os.path.join(ROOT, 'tools', 'readme')
OUT = os.path.join(ROOT, 'media')
NM = os.path.join(ROOT, 'node_modules')
SERIF = NM + '/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2'
ITALIC = NM + '/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2'
MONO = NM + '/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'

TITLE = 'Destino'
PHRASE = 'From the first thought to the last thing we could ever build.'

W, H = 960, 360            # layout units
CW, CH = 580, 326          # the clip
Z = 1840 / W               # px per unit
PW, PH = round(W * Z), round(H * Z)
FPS = 30
WEBP_W, WEBP_Q = 920, 70
XFADE = 18                 # frames of crossfade when looping forwards
BAND = 330                 # the cover's title band, px

THEMES = {
    'dark': dict(page=(13, 17, 23), ink=(236, 231, 219), dim=(236, 231, 219, 150), acc=(111, 227, 193)),
    'light': dict(page=(255, 255, 255), ink=(31, 29, 26), dim=(31, 29, 26, 160), acc=(16, 128, 98)),
}

# name, frames dir, start, count, crop (x, y, w, h) in the 1840 x 1035 frames, power exponent (W), title, line, loop
# (the remake: frames from viaje/, captured with tools/clip-viaje.mjs and tools/readme-viaje.json)
MOMENTS = [
    ('planets', 'r-planets', 0, 150, (0, 0, 1840, 1035), '37', 'Planets everywhere',
     'At least one for every star: system after system, many where there could be water.', 'forward'),
    ('nerves', 'r-nerves2', 0, 150, (0, 0, 1840, 1035), '-3', 'Nerves',
     'Cells began passing sparks to each other: a whole body reacts at once.', 'forward'),
    ('machines', 'r-machines', 0, 150, (0, 0, 1840, 1035), '13', 'Machines that think',
     'Now we think outside our heads too, in halls of machines that grow every year.', 'forward'),
    ('sun', 'r-sun', 0, 150, (240, 0, 1600, 900), '25', 'Moving the Sun',
     'A mirror sends part of its light back and pushes it, slowly.', 'forward'),
    ('ship', 'r-ship2', 0, 150, (0, 0, 1840, 1035), '27', 'Ships that are worlds',
     'Centuries between stars: whoever arrives never saw the Earth.', 'forward'),
    ('hole', 'r-hole2', 0, 150, (0, 0, 1840, 1035), '29', 'The last power plants',
     'When the stars go out, black holes remain: energy can still be drawn from their spin.', 'forward'),
]
# The hero, as in Espacio and Tiempo: one unbroken flight from the Earth past the Moon, Mars, Venus and
# Mercury to the Sun, lingering on each and longest on the Sun (Diego, 31 Oct, over eight shots across
# the scales: python ... cover2 still draws that one, from its h* clips).
HERO = dict(clips=['s-sistema'], crop=(0, 0, 1840, 1035), crf=42, join=14, webp_q=45)
HERO2 = dict(clips=['h1-neurona', 'h2-medusa', 'h3-cerebros', 'h4-luna', 'h5-venus', 'h6-nave', 'h7-galaxia', 'h8-agujero'],
             crop=(0, 0, 1840, 1035), crf=42, join=10, webp_q=45)
# (busy textures, the mirror's plates, cost far more to encode: these take a higher CRF to stay light)
CRF = {'sun': 42}


def px(v):
    return round(v * Z)


def feather(w, h, p=3, inner=0.6):
    """A soft superellipse: 1 in the middle, 0 at the edges, no corners."""
    u = np.abs(np.linspace(-1, 1, w))[None, :]
    v = np.abs(np.linspace(-1, 1, h))[:, None]
    d = (u ** p + v ** p) ** (1 / p)
    t = np.clip((d - inner) / (1 - inner), 0, 1)
    return 1 - t * t * (3 - 2 * t)


def card(w, h, r=22):
    """Light theme: a crisp rounded card (anti-aliased by supersampling)."""
    im = Image.new('L', (w * 4, h * 4), 0)
    ImageDraw.Draw(im).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), px(r) * 4, fill=255)
    return np.asarray(im.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255


def text_layer(exp, title, line, tx, th):
    f_t = ImageFont.truetype(SERIF, px(50))
    f_l = ImageFont.truetype(ITALIC, px(27))
    f_m = ImageFont.truetype(MONO, px(22))
    f_ms = ImageFont.truetype(MONO, px(14))
    tl = textwrap.wrap(title, 15)
    ll = textwrap.wrap(line, 30)
    block = 44 + 52 * len(tl) + 14 + 32 * len(ll)
    im = Image.new('RGBA', (PW, PH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    y = (H - block) // 2
    # the power in use: 10^exp W
    x = px(tx)
    d.text((x, px(y)), '10', font=f_m, fill=th['acc'])
    x += d.textlength('10', font=f_m) + px(1)
    d.text((x, px(y - 9)), exp, font=f_ms, fill=th['acc'])
    x += d.textlength(exp, font=f_ms) + px(9)
    d.text((x, px(y)), 'W', font=f_m, fill=th['acc'])
    y += 44
    for ln in tl:
        d.text((px(tx), px(y)), ln, font=f_t, fill=th['ink'])
        y += 52
    y += 14
    for ln in ll:
        d.text((px(tx), px(y)), ln, font=f_l, fill=th['dim'])
        y += 32
    return np.asarray(im, dtype=np.float32) / 255


def encode_avif(dst, w, h, crf=34):
    return subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(FPS), '-i', '-',
         '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
         '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv',
         '-c:v', 'libsvtav1', '-preset', '5', '-crf', str(crf), '-g', '600', '-loop', '0', dst],
        stdin=subprocess.PIPE)


def sequence(start, count, mode):
    """Frame indices, or (a, b, w) blends for the crossfade of a forward loop."""
    idx = list(range(start, start + count))
    if mode == 'pingpong':
        return [(i, None, 0) for i in idx + idx[-2:0:-1]]
    # forwards: the last frames fade into the first ones, so the loop has no seam
    body = idx[:-XFADE]
    tail = [(idx[-XFADE + k], idx[k], (k + 1) / (XFADE + 1)) for k in range(XFADE)]
    return [(i, None, 0) for i in body[XFADE:]] + tail


def loader(clip, crop, size):
    x, y, w, h = crop
    cache = {}
    def frame(i):
        if i not in cache:
            im = Image.open(os.path.join(FR, clip, f'{i:04d}.jpg')).convert('RGB')
            if im.size != (1840, 1035):
                print(f'  warning: {clip}/{i:04d} is {im.size[0]} x {im.size[1]} (captured at lower quality?)', flush=True)
                im = im.resize((1840, 1035), Image.LANCZOS)
            im = im.crop((x, y, x + w, y + h)).resize(size, Image.LANCZOS)
            cache[i] = np.asarray(im, dtype=np.float32) / 255
            if len(cache) > 48:
                cache.pop(next(iter(cache)))
        return cache[i]
    return frame


def write(dst, frames, w, h, crf=34, webp_q=WEBP_Q):
    enc = encode_avif(dst + '.avif', w, h, crf)
    webp = []
    for n, out in enumerate(frames):
        img = Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8), 'RGB')
        enc.stdin.write(img.tobytes())
        if n % 2 == 0:
            webp.append(img.resize((WEBP_W, round(h * WEBP_W / w)), Image.LANCZOS))
    enc.stdin.close()
    enc.wait()
    webp[0].save(dst + '.webp', save_all=True, append_images=webp[1:], duration=2000 // FPS, loop=0, quality=webp_q, method=4)
    print(f'  {os.path.basename(dst)}: {len(webp) * 2} frames  {w}x{h}  avif {os.path.getsize(dst + ".avif") / 1e6:.2f} MB'
          f'  webp {os.path.getsize(dst + ".webp") / 1e6:.2f} MB', flush=True)


def moment(k, m):
    name, clip, start, count, crop, exp, title, line, mode = m
    left = k % 2 == 0
    cw, ch = px(CW), px(CH)
    cx = 0 if left else PW - cw
    cy = (PH - ch) // 2
    tx = CW + 10 if left else 30
    frame = loader(clip, crop, (cw, ch))
    seq = sequence(start, count, mode)
    mask, rounded = feather(cw, ch), card(cw, ch)
    for theme, th in THEMES.items():
        page = np.array(th['page'], np.float32) / 255
        txt = text_layer(exp, title, line, tx, th)
        ta = txt[..., 3:4]
        def frames():
            for a, bb, wgt in seq:
                rgb = frame(a) if bb is None else frame(a) * (1 - wgt) + frame(bb) * wgt
                # dark: screened over the page (black becomes the page), feathered; light: a rounded card
                col, al = (page + rgb * (1 - page), mask) if theme == 'dark' else (rgb, rounded)
                out = np.empty((PH, PW, 3), np.float32)
                out[:] = page
                out[cy:cy + ch, cx:cx + cw] = col * al[..., None] + page * (1 - al[..., None])
                yield txt[..., :3] * ta + out * (1 - ta)
        write(os.path.join(OUT, f'{name}-{theme}'), frames(), PW, PH, CRF.get(name, 34))


def band(th):
    """The title and its phrase, drawn straight at full size (never scaled)."""
    im = Image.new('RGBA', (PW, BAND), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((PW // 2, 205), TITLE, font=ImageFont.truetype(SERIF, 196), fill=th['ink'], anchor='ms')
    d.text((PW // 2, 285), PHRASE, font=ImageFont.truetype(ITALIC, 46), fill=th['ink'] + (180,), anchor='ms')
    return np.asarray(im, dtype=np.float32) / 255


def hero_sequence(HERO=HERO):
    """(clip, frame) pairs and blends: each clip whole, the next fading in over its last `join` frames,
    and the last fading into the first, so the loop has no seam."""
    j = HERO['join']
    clips = [(c, len([f for f in os.listdir(os.path.join(FR, c)) if f.endswith('.jpg')])) for c in HERO['clips']]
    seq = []
    for k, (c, n) in enumerate(clips):
        nc, nn = clips[(k + 1) % len(clips)]
        for i in range(j, n - j):           # its first j frames live in the previous blend
            seq.append(((c, i), None, 0))
        for i in range(j):
            seq.append(((c, n - j + i), (nc, i), (i + 1) / (j + 1)))
    return seq


def cover(HERO=HERO, nombre='cover'):
    """The title over the hero, blended into the page and looping forwards."""
    x, y, w, h = HERO['crop']
    vh = round(PW * h / w)
    loaders = {c: loader(c, HERO['crop'], (PW, vh)) for c in HERO['clips']}
    frame = lambda ci: loaders[ci[0]](ci[1])
    seq = hero_sequence(HERO)
    mask, rounded = feather(PW, vh, inner=0.72), card(PW, vh, r=21)
    for theme, th in THEMES.items():
        page = np.array(th['page'], np.float32) / 255
        txt = band(th)
        ta = txt[..., 3:4]
        top = txt[..., :3] * ta + page * (1 - ta)
        def frames():
            out = np.empty((BAND + vh, PW, 3), np.float32)
            out[:BAND] = top
            for a, bb, wgt in seq:
                rgb = frame(a) if bb is None else frame(a) * (1 - wgt) + frame(bb) * wgt
                col, al = (page + rgb * (1 - page), mask) if theme == 'dark' else (rgb, rounded)
                out[BAND:] = col * al[..., None] + page * (1 - al[..., None])
                yield out
        write(os.path.join(OUT, f'{nombre}-{theme}'), frames(), PW, BAND + vh, HERO['crf'], HERO['webp_q'])


if __name__ == '__main__':
    which = sys.argv[1:]
    if not which or 'cover' in which:
        cover()
    if 'cover2' in which:
        cover(HERO2, 'cover2')
    for k, m in enumerate(MOMENTS):
        if not which or m[0] in which:
            moment(k, m)
