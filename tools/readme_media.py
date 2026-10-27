"""The README, as in Espacio and Tiempo: a cover (the title over the hero clip) and six moments, each a
captured clip on one side and its power and caption on the other.

    node tools/clip.mjs tools/readme.json tools/readme   (the frames, from the piece itself; dev server on)
    python tools/readme_media.py [cover brain ...]       ->  media/<name>-<theme>.avif / .webp

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
PHRASE = 'From the first thought to the last power plant.'

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
MOMENTS = [
    ('brain', 'brain', 0, 120, (220, 125, 1440, 810), '1', 'A brain',
     'Twenty watts, and it wonders whether anyone else is out there.', 'pingpong'),
    ('industry', 'industry', 0, 150, (200, 60, 1440, 810), '16', 'Industry moves into space',
     'Up the elevator: in orbit, its heat goes straight into the void.', 'forward'),
    ('inside', 'inside', 0, 150, (0, 0, 1840, 1035), '16', 'A world inside',
     'A cylinder 8 km wide turns every two minutes, and the land climbs overhead.', 'forward'),
    ('wall', 'wall', 0, 150, (0, 0, 1840, 1035), '20', 'The wall that covers the Sun',
     'A swarm of collectors, each on its own orbit, catching the starlight.', 'forward'),
    ('ship', 'ship', 0, 120, (0, 60, 1680, 945), '27', 'Ships that are worlds',
     'At one percent of the speed of light, the crew’s great-grandchildren arrive.', 'pingpong'),
    ('star', 'star', 0, 120, (420, 60, 1420, 799), '37', 'Thinking with a star',
     'Shells of computers around a star, each one fed by the heat of the last.', 'pingpong'),
]
HERO = dict(clip='hero', count=300, crop=(0, 0, 1840, 1035), crf=34)


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
        write(os.path.join(OUT, f'{name}-{theme}'), frames(), PW, PH)


def band(th):
    """The title and its phrase, drawn straight at full size (never scaled)."""
    im = Image.new('RGBA', (PW, BAND), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((PW // 2, 205), TITLE, font=ImageFont.truetype(SERIF, 196), fill=th['ink'], anchor='ms')
    d.text((PW // 2, 285), PHRASE, font=ImageFont.truetype(ITALIC, 46), fill=th['ink'] + (180,), anchor='ms')
    return np.asarray(im, dtype=np.float32) / 255


def cover():
    """The title over the hero, the most striking moment, blended into the page and looping forwards."""
    x, y, w, h = HERO['crop']
    vh = round(PW * h / w)
    frame = loader(HERO['clip'], HERO['crop'], (PW, vh))
    seq = sequence(0, HERO['count'], 'forward')
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
        write(os.path.join(OUT, f'cover-{theme}'), frames(), PW, BAND + vh, HERO['crf'], WEBP_Q - 12)


if __name__ == '__main__':
    which = sys.argv[1:]
    if not which or 'cover' in which:
        cover()
    for k, m in enumerate(MOMENTS):
        if not which or m[0] in which:
            moment(k, m)
